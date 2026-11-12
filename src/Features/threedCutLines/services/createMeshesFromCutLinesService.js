import db from "App/db/db";
import { getFaceRegion } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import createMesh3dService from "Features/threedMesh/services/createMesh3dService";
import { buildWorldSoup } from "Features/threedMesh/utils/buildMeshDataFromRegion";
import computePlaneBasis from "Features/threedMesh/utils/computePlaneBasis";
import {
  COVER_NORMAL_DOT,
  COVER_PLANE_TOL_M,
} from "Features/threedMesh/utils/mesh3dConstants";
import {
  collectAnnotationSolidMeshes,
  getAnnotationMergedHost,
} from "Features/threedMesh/utils/getAnnotationFaceRegion";
import pointInPolygon2d from "Features/threedMesh/utils/pointInPolygon2d";
import { projectPointTo2d } from "Features/threedMesh/utils/planeProjection";
import { cross, dot, sub } from "Features/threedMesh/utils/vec3Utils";

import buildMeshDataFromPieces from "../utils/buildMeshDataFromPieces";
import clipRegionByCutLines from "../utils/clipRegionByCutLines";
import { getCutLinesWorldPolylines } from "./cutLineObjectsStore";

// « Mailler » (Maillage module, command CREATE_MESHES): one maille per GROUP of pieces of
// every face region of the visible annotations that the cut lines cross
// (clipRegionByCutLines: the region — planar or faceted, grown over the
// whole annotation like the hover, see getAnnotationFaceRegion — cut facet
// by facet, the pieces joined back across the creases). Groups no line
// bounds produce nothing; a group whose cut pieces all have their centroid
// inside an existing maille (coplanar face, or shell triangle) is skipped
// (user decisions 2026-11-03). Each maille takes its source annotation's
// hue, like the CREATE tool.
//
// Returns { created, skippedCovered, facesCut }.
export default async function createMeshesFromCutLinesService({
  editor,
  projectId,
  scopeId,
  angleDeg,
}) {
  const sceneManager = editor?.sceneManager;
  if (!sceneManager || !projectId || !scopeId) {
    return { created: 0, skippedCovered: 0, facesCut: 0 };
  }
  const cutLines = getCutLinesWorldPolylines().map((l) => l.points);
  if (!cutLines.length) return { created: 0, skippedCovered: 0, facesCut: 0 };

  const existing = (
    await db.meshes3d
      .where("[projectId+scopeId]")
      .equals([projectId, scopeId])
      .toArray()
  ).filter((r) => !r.deletedAt);
  const existingFaces = existing.flatMap((r) => r.faces || []);
  const existingShells = existing
    .map((r) => r.shell)
    .filter((shell) => shell?.positions?.length);

  let created = 0;
  let skippedCovered = 0;
  let facesCut = 0;
  const colorByAnnotationId = new Map();

  const roots = Object.values(
    sceneManager.annotationsManager?.annotationsObjectsMap || {}
  ).filter((root) => root?.visible && root.userData?.nodeId);

  for (const root of roots) {
    const annotationId = root.userData.nodeId;
    for (const host of collectHosts(root)) {
      const { geometry, matrixWorld, plane } = host;
      const index = geometry?.index;
      const triCount = index
        ? index.count / 3
        : (geometry?.attributes?.position?.count ?? 0) / 3;
      if (!triCount) continue;

      const assigned = new Uint8Array(triCount);
      for (let t = 0; t < triCount; t++) {
        if (assigned[t]) continue;
        const region = getFaceRegion(geometry, t, { plane, angleDeg });
        if (!region?.tris?.length) {
          assigned[t] = 1;
          continue;
        }
        region.tris.forEach((i) => {
          assigned[i] = 1;
        });
        const soup = buildWorldSoup(geometry, matrixWorld, region.tris);
        if (!soup) continue;
        const clip = clipRegionByCutLines({
          positions: soup.positions,
          tris: soup.tris,
          cutLines,
        });
        const groups = (clip?.groups || []).filter((g) => g.cut);
        if (!groups.length) continue;
        facesCut += 1;

        let baseColor = colorByAnnotationId.get(annotationId);
        if (baseColor === undefined) {
          const annotation = await db.annotations.get(annotationId);
          baseColor = annotation?.fillColor || annotation?.strokeColor || null;
          colorByAnnotationId.set(annotationId, baseColor);
        }

        for (const group of groups) {
          const pieces = group.pieceIndices.map((i) => clip.pieces[i]);
          if (isGroupCovered(pieces, existingFaces, existingShells)) {
            skippedCovered += 1;
            continue;
          }
          const meshData = buildMeshDataFromPieces(pieces);
          if (!meshData) continue;
          const row = await createMesh3dService({
            projectId,
            scopeId,
            faces: meshData.faces,
            shell: meshData.shell,
            baseColor,
            sourceInfo: { annotationId, fromCutLines: true },
          });
          if (row) {
            created += 1;
            existingFaces.push(...(row.faces || []));
            if (row.shell?.positions?.length) existingShells.push(row.shell);
          }
        }
      }
    }
  }
  return { created, skippedCovered, facesCut };
}

// The geometries to walk for one annotation root: its merged host (every
// solid mesh in the root's frame) when it has several, else each solid mesh
// on its own (plane mode on a CSG-carved mesh) — the same split as the hover.
function collectHosts(root) {
  const merged = getAnnotationMergedHost(root);
  if (merged) {
    root.updateWorldMatrix(true, false);
    return [
      {
        geometry: merged.geometry,
        matrixWorld: root.matrixWorld,
        plane: false,
      },
    ];
  }
  return collectAnnotationSolidMeshes(root).map((mesh) => {
    mesh.updateWorldMatrix(true, false);
    return {
      geometry: mesh.geometry,
      matrixWorld: mesh.matrixWorld,
      plane: !!mesh.userData?.hasSubtraction,
    };
  });
}

// Every cut piece of the group has its centroid inside an existing maille.
function isGroupCovered(pieces, faces, shells) {
  const cut = pieces.filter((p) => p.cut && p.centroid);
  if (!cut.length) return false;
  return cut.every(
    (piece) =>
      isCoveredByExistingFace(piece, faces) ||
      isCoveredByExistingShell(piece.centroid, shells)
  );
}

// The piece's centroid lies inside an existing face of the same plane.
function isCoveredByExistingFace(piece, faces) {
  const c = piece.centroid;
  const n = piece.normal;
  if (!c || !n) return false;
  for (const face of faces) {
    const fn = face?.normal;
    const contour = face?.contour;
    if (!fn || !contour?.length) continue;
    const dot = fn.x * n.x + fn.y * n.y + fn.z * n.z;
    if (Math.abs(dot) < COVER_NORMAL_DOT) continue;
    const a = contour[0];
    const d = fn.x * (c.x - a.x) + fn.y * (c.y - a.y) + fn.z * (c.z - a.z);
    if (Math.abs(d) > COVER_PLANE_TOL_M) continue;
    const basis = computePlaneBasis(fn, a);
    const c2 = projectPointTo2d(c, basis);
    const inContour = pointInPolygon2d(
      c2,
      contour.map((p) => projectPointTo2d(p, basis))
    );
    if (!inContour) continue;
    const inHole = (face.holes || []).some((hole) =>
      pointInPolygon2d(
        c2,
        hole.map((p) => projectPointTo2d(p, basis))
      )
    );
    if (!inHole) return true;
  }
  return false;
}

// The point lies on a triangle of an existing shell (within the plane
// tolerance, barycentric inside with a hair of slack).
function isCoveredByExistingShell(point, shells) {
  for (const shell of shells) {
    const pos = shell.positions;
    for (let i = 0; i + 8 < pos.length; i += 9) {
      const a = { x: pos[i], y: pos[i + 1], z: pos[i + 2] };
      const b = { x: pos[i + 3], y: pos[i + 4], z: pos[i + 5] };
      const c = { x: pos[i + 6], y: pos[i + 7], z: pos[i + 8] };
      if (pointOnTriangle(point, a, b, c)) return true;
    }
  }
  return false;
}

function pointOnTriangle(p, a, b, c) {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const n = cross(ab, ac);
  const nn = dot(n, n);
  if (nn < 1e-18) return false;
  const ap = sub(p, a);
  const dist = Math.abs(dot(ap, n)) / Math.sqrt(nn);
  if (dist > COVER_PLANE_TOL_M) return false;
  // Barycentric coordinates in the triangle plane.
  const d00 = dot(ab, ab);
  const d01 = dot(ab, ac);
  const d11 = dot(ac, ac);
  const d20 = dot(ap, ab);
  const d21 = dot(ap, ac);
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-18) return false;
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const eps = 1e-6;
  return v >= -eps && w >= -eps && v + w <= 1 + eps;
}
