import polygonClipping from "polygon-clipping";

import { buildMesh3dFromPlanarFaces } from "../../annotationMesh3d/utils/buildMesh3dFromTriangles.js";
import { WELD_PRECISION_M } from "../../annotationMesh3d/utils/mesh3dConstants.js";
import { getMesh3dSignedVolume } from "../../annotationMesh3d/utils/getMesh3dQties.js";
import isMesh3dClosed from "../../annotationMesh3d/utils/isMesh3dClosed.js";
import {
  getFaceNormal,
  reverseFace,
} from "../../annotationMesh3d/utils/mesh3dTopology.js";
import coalesceCoplanarFaces, {
  COALESCE_NORMAL_TOL_RAD,
  COALESCE_PLANE_TOL_M,
} from "../../threedMesh/utils/coalesceCoplanarFaces.js";
import computePlaneBasis from "../../threedMesh/utils/computePlaneBasis.js";
import { signedArea2d } from "../../threedMesh/utils/computeFaceArea.js";
import {
  liftLoopTo3d,
  projectLoopTo2d,
} from "../../threedMesh/utils/planeProjection.js";
import { dot } from "../../threedMesh/utils/vec3Utils.js";

// Union of two annotation meshes that touch along coplanar faces — the
// « Fusionner des faces » command. Both meshes are in the SAME base-map-local
// frame with ABSOLUTE z (meters); the result is one mesh in that frame.
//
// 1. the faces of the two meshes that look at each other on a same plane
//    (the contact: the end cap of a wall against the end cap of the next
//    one) are replaced by their 2D differences — identical caps vanish, a
//    taller cap keeps the part that is not covered;
// 2. on every plane, a face of A and a face of B that touch or overlap are
//    unioned into one face (coalesceCoplanarFaces on the PAIR): that is what
//    removes the drawn seam between the two coplanar faces. Two faces of the
//    SAME mesh are never unioned — a line drawn on a face (« Coupe face »)
//    splits it on purpose and must survive the merge;
// 3. the planar faces are re-indexed into a mesh (buildMesh3dFromPlanarFaces:
//    weld, T-junctions, cleanup).
//
// seedPlane: { point, normal } of the face the merge was launched from. The
// merge is refused (NOT_TOUCHING) when no face of A was unioned with a face
// of B on that plane: the two clicked faces are coplanar but do not touch,
// and a merge would leave one annotation in two pieces. The seed plane was
// read on the DISPLAYED geometry, which may be shrunk (« Réduire le
// crénelage », 10 mm lateral / 5 mm top) while the meshes here are not: it
// is matched with a loose tolerance and whatever its orientation.
//
// clickedNormal: normal of the clicked face of B as displayed. An open mesh
// keeps the raw winding of its builder (convertObject3DToMesh3d only
// normalizes closed solids), so B may be wound inside out: when its clicked
// face looks the other way than the seed plane, the whole of B is reversed
// first — the two faces the user merges are the same side by definition. A
// closed result is finally wound outward (signed volume).
//
// Pure (no three.js): node-testable, relative imports only.

export const MERGE_MESH3D_REASONS = {
  NOT_TOUCHING: "NOT_TOUCHING",
  EMPTY: "EMPTY",
};

const COS_TOL = Math.cos(COALESCE_NORMAL_TOL_RAD);
// Contact overlaps smaller than this (m²) are edge contacts, not faces.
const MIN_CONTACT_AREA_M2 = 1e-8;
// Seed plane match: covers the anti-aliasing shrink of the displayed
// geometry it was read on.
const SEED_PLANE_TOL_M = 0.015;

const closeRing = (ring) => {
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  return ring;
};
const openLoop = (ring) =>
  ring.slice(0, ring.length - 1).map(([x, y]) => ({ x, y }));

function withWinding(loop, ccw) {
  const area = signedArea2d(loop);
  if (area === 0) return null;
  return area > 0 === ccw ? loop : [...loop].reverse();
}

const snap = (v) => Math.round(v / WELD_PRECISION_M) * WELD_PRECISION_M;

function toRawFaces(mesh, tag) {
  const out = [];
  for (const face of mesh?.faces || []) {
    if (!(face?.loop?.length >= 3)) continue;
    const toPoints = (loop) => loop.map((vi) => mesh.vertices[vi]);
    const normal = getFaceNormal(mesh.vertices, face);
    if (!Number.isFinite(normal.x)) continue;
    out.push({
      contour: toPoints(face.loop),
      holes: (face.holes || []).map(toPoints),
      normal,
      tags: new Set([tag]),
    });
  }
  return out;
}

const samePlane = (a, b, cosTol, tol = COALESCE_PLANE_TOL_M) =>
  dot(a.normal, b.normal) >= cosTol &&
  Math.abs(dot(a.normal, a.contour[0]) - dot(a.normal, b.contour[0])) <= tol;

// Same plane whatever the orientation (seed plane match).
const sameUnsignedPlane = (a, b, cosTol, tol) =>
  samePlane(a, b, cosTol, tol) || samePlane(a, flipped(b), cosTol, tol);

// Faces of `b` reversed to be measured in `a`'s plane (opposite normal).
const flipped = (face) => ({
  ...face,
  normal: { x: -face.normal.x, y: -face.normal.y, z: -face.normal.z },
});

function toPolygon2d(face, basis) {
  return [face.contour, ...(face.holes || [])]
    .filter((loop) => loop?.length >= 3)
    .map((loop) =>
      closeRing(projectLoopTo2d(loop, basis).map((p) => [snap(p.x), snap(p.y)]))
    );
}

function fromMultiPolygon2d(multi, basis, normal, ccw) {
  const faces = [];
  for (const polygon of multi || []) {
    if (!polygon.length) continue;
    const contour = withWinding(openLoop(polygon[0]), ccw);
    if (!contour || contour.length < 3) continue;
    const holes = polygon
      .slice(1)
      .map((ring) => withWinding(openLoop(ring), !ccw))
      .filter((hole) => hole && hole.length >= 3);
    faces.push({
      contour: liftLoopTo3d(contour, basis),
      holes: holes.map((hole) => liftLoopTo3d(hole, basis)),
      normal: { ...normal },
    });
  }
  return faces;
}

const multiArea = (multi) =>
  (multi || []).reduce(
    (sum, polygon) =>
      sum +
      polygon.reduce(
        (acc, ring, i) =>
          acc + (i === 0 ? 1 : -1) * Math.abs(signedArea2d(openLoop(ring))),
        0
      ),
    0
  );

// Step 1: contact faces. Every (a, b) pair of opposite coplanar faces that
// overlap is replaced by a − b and b − a (in a's plane basis).
function resolveContacts(facesA, facesB) {
  let listA = facesA.map((f) => ({ ...f }));
  let listB = facesB.map((f) => ({ ...f }));
  for (let i = 0; i < listA.length; i++) {
    const a = listA[i];
    if (!a) continue;
    for (let j = 0; j < listB.length; j++) {
      const b = listB[j];
      if (!b || !samePlane(a, flipped(b), COS_TOL)) continue;
      const basis = computePlaneBasis(a.normal, a.contour[0]);
      const polyA = toPolygon2d(a, basis);
      const polyB = toPolygon2d(b, basis);
      let inter;
      let restA;
      let restB;
      try {
        inter = polygonClipping.intersection([polyA], [polyB]);
        if (multiArea(inter) < MIN_CONTACT_AREA_M2) continue;
        restA = polygonClipping.difference([polyA], [polyB]);
        restB = polygonClipping.difference([polyB], [polyA]);
      } catch (error) {
        console.error("[mergeMesh3dSolids] polygon-clipping error:", error);
        continue;
      }
      const nextA = fromMultiPolygon2d(restA, basis, a.normal, true).map(
        (f) => ({ ...f, tags: a.tags })
      );
      const nextB = fromMultiPolygon2d(restB, basis, b.normal, false).map(
        (f) => ({ ...f, tags: b.tags })
      );
      // Replace a by its remainder(s) and keep scanning them against the
      // other faces of B; same for b.
      listA.splice(i, 1, ...nextA);
      listB.splice(j, 1, ...nextB);
      // Restart this slot: the remainder (or the next face) must be checked
      // against every face of B again.
      i -= 1;
      break;
    }
  }
  listA = listA.filter(Boolean);
  listB = listB.filter(Boolean);
  return [...listA, ...listB];
}

// Step 2: cross-mesh unions on each plane. Returns the faces and whether a
// union happened on the seed plane.
function unionAcross(faces, seedPlane) {
  const list = [...faces];
  let mergedOnSeedPlane = false;
  const seed =
    seedPlane?.normal && seedPlane?.point
      ? { normal: seedPlane.normal, contour: [seedPlane.point] }
      : null;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < list.length && !changed; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        // Only faces of DIFFERENT meshes union; a face already unioned
        // carries both tags and never absorbs another face of either mesh
        // (a drawn split next to the seam survives).
        if (a.tags.size !== 1 || b.tags.size !== 1) continue;
        if (a.tags.has([...b.tags][0]) || !samePlane(a, b, COS_TOL)) continue;
        const unioned = coalesceCoplanarFaces([a, b]);
        if (unioned.length !== 1) continue;
        const merged = { ...unioned[0], tags: new Set([...a.tags, ...b.tags]) };
        if (seed && sameUnsignedPlane(a, seed, COS_TOL, SEED_PLANE_TOL_M)) {
          mergedOnSeedPlane = true;
        }
        list.splice(j, 1);
        list.splice(i, 1, merged);
        changed = true;
        break;
      }
    }
  }
  return { faces: list, mergedOnSeedPlane };
}

/**
 * @param {object} meshA - LOCAL mesh { vertices: [{x,y,z}], faces } (z absolute)
 * @param {object} meshB - same frame
 * @param {{ seedPlane?: { point: {x,y,z}, normal: {x,y,z} },
 *   clickedNormal?: {x,y,z} }} [options]
 * @returns {{ ok: true, mesh } | { ok: false, reason }}
 */
export default function mergeMesh3dSolids(
  meshA,
  meshB,
  { seedPlane, clickedNormal } = {}
) {
  const facesA = toRawFaces(meshA, "A");
  let facesB = toRawFaces(meshB, "B");
  if (!facesA.length || !facesB.length) {
    return { ok: false, reason: MERGE_MESH3D_REASONS.EMPTY };
  }
  if (
    seedPlane?.normal &&
    clickedNormal &&
    dot(seedPlane.normal, clickedNormal) < 0
  ) {
    facesB = toRawFaces(
      { vertices: meshB.vertices, faces: meshB.faces.map(reverseFace) },
      "B"
    );
  }

  const afterContacts = resolveContacts(facesA, facesB);
  const { faces, mergedOnSeedPlane } = unionAcross(afterContacts, seedPlane);
  if (seedPlane && !mergedOnSeedPlane) {
    return { ok: false, reason: MERGE_MESH3D_REASONS.NOT_TOUCHING };
  }

  let mesh = buildMesh3dFromPlanarFaces(
    faces.map(({ contour, holes, normal }) => ({ contour, holes, normal }))
  );
  if (!mesh?.faces?.length) {
    return { ok: false, reason: MERGE_MESH3D_REASONS.EMPTY };
  }
  if (isMesh3dClosed(mesh) && getMesh3dSignedVolume(mesh) < 0) {
    mesh = { vertices: mesh.vertices, faces: mesh.faces.map(reverseFace) };
  }
  return { ok: true, mesh };
}
