import extractRegionBoundaryLoops from "../../threedMesh/utils/extractRegionBoundaryLoops.js";
import splitTrisIntoComponents from "../../threedMesh/utils/splitTrisIntoComponents.js";
import {
  cross,
  dot,
  length,
  normalize,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

import { WELD_PRECISION_M } from "./mesh3dConstants.js";
import { cleanupMesh3d, getFaceLoops } from "./mesh3dTopology.js";

// Triangle soup of an annotation's 3D solid -> mesh of planar polygon faces
// (LOCAL form). This is how a regular annotation (extruded polygon, thick
// wall...) becomes an isMesh3d annotation the first time one of its faces is
// edited.
//
// 1. triangles are grouped per plane (signed normal + offset), then per
//    edge-connected component: each component is one face (contour + holes);
// 2. coincident faces looking at each other (internal partitions of solids
//    built from several abutting pieces) cancel out;
// 3. vertices are welded into a shared index, and a vertex lying in the
//    middle of another face's edge is inserted into that edge (T-junction),
//    so every shared edge matches on both sides.
//
// Pure (no three.js). positions: flat xyz array; index: triangle index or
// null (soup). Returns { vertices: [{x, y, z}], faces: [{loop, holes}] } or
// null.

// Angular / offset slack of the plane grouping: float32 noise only.
const PLANE_NORMAL_COS = Math.cos(2e-3);
const PLANE_OFFSET_TOL_M = 5e-4;
const MIN_TRIANGLE_AREA2 = 1e-12;

export default function buildMesh3dFromTriangles({ positions, index = null }) {
  if (!positions?.length) return null;
  const triCount = (index ? index.length : positions.length / 3) / 3;
  const vertIndex = index ? (t, c) => index[3 * t + c] : (t, c) => 3 * t + c;
  const getPos = (vi) => ({
    x: positions[3 * vi],
    y: positions[3 * vi + 1],
    z: positions[3 * vi + 2],
  });

  // 1. Plane groups (greedy first match, like coalesceCoplanarFaces).
  const groups = [];
  for (let t = 0; t < triCount; t++) {
    const a = getPos(vertIndex(t, 0));
    const b = getPos(vertIndex(t, 1));
    const c = getPos(vertIndex(t, 2));
    const raw = cross(sub(b, a), sub(c, a));
    if (length(raw) < MIN_TRIANGLE_AREA2) continue;
    const n = normalize(raw);
    const d = dot(n, a);
    const group = groups.find(
      (g) =>
        dot(g.n, n) >= PLANE_NORMAL_COS &&
        Math.abs(dot(g.n, a) - g.d) <= PLANE_OFFSET_TOL_M
    );
    if (group) group.tris.push(t);
    else groups.push({ n, d, tris: [t] });
  }

  const rawFaces = [];
  for (const group of groups) {
    for (const tris of splitTrisIntoComponents({
      positions,
      index,
      tris: group.tris,
    })) {
      const loops = extractRegionBoundaryLoops({ positions, index, tris });
      if (loops) rawFaces.push({ ...loops, normal: group.n });
    }
  }
  if (!rawFaces.length) return null;

  return buildMesh3dFromPlanarFaces(rawFaces);
}

// Planar polygon faces -> indexed mesh (LOCAL form): steps 2, 3a and 3b
// above, shared with the merge of two annotation meshes
// (threedMergeFaces/utils/mergeMesh3dSolids.js), whose inputs are polygon
// faces already. rawFaces: [{ contour: [{x,y,z}], holes: [[{x,y,z}]],
// normal }], contour CCW around `normal`, holes CW. Returns null when
// everything cancels out.
export function buildMesh3dFromPlanarFaces(rawFaces) {
  if (!rawFaces?.length) return null;
  // 3a. Weld.
  const vertices = [];
  const idByKey = new Map();
  const q = (v) => Math.round(v / WELD_PRECISION_M);
  const weld = (p) => {
    const key = `${q(p.x)},${q(p.y)},${q(p.z)}`;
    let id = idByKey.get(key);
    if (id === undefined) {
      id = vertices.length;
      idByKey.set(key, id);
      vertices.push({ x: p.x, y: p.y, z: p.z });
    }
    return id;
  };
  let faces = rawFaces.map((face) => ({
    loop: face.contour.map(weld),
    holes: (face.holes || []).map((hole) => hole.map(weld)),
    normal: face.normal,
  }));

  // 2. Cancel coincident opposite faces (same vertex set, opposite normal).
  const signature = (face) =>
    getFaceLoops(face)
      .map((loop) => [...loop].sort((i, j) => i - j).join("_"))
      .sort()
      .join("|");
  const bySignature = new Map();
  faces.forEach((face, i) => {
    const key = signature(face);
    if (!bySignature.has(key)) bySignature.set(key, []);
    bySignature.get(key).push(i);
  });
  const dropped = new Set();
  for (const indices of bySignature.values()) {
    const pending = [];
    for (const i of indices) {
      const match = pending.findIndex(
        (j) => dot(faces[i].normal, faces[j].normal) < -0.99
      );
      if (match >= 0) {
        dropped.add(i);
        dropped.add(pending[match]);
        pending.splice(match, 1);
      } else {
        pending.push(i);
      }
    }
  }
  faces = faces
    .filter((_, i) => !dropped.has(i))
    .map(({ loop, holes }) => ({ loop, holes }));
  if (!faces.length) return null;

  // 3b. T-junctions: splice every vertex lying inside a loop edge.
  const used = new Set();
  for (const face of faces) {
    for (const loop of getFaceLoops(face)) loop.forEach((vi) => used.add(vi));
  }
  const candidates = [...used];
  const tolSq = WELD_PRECISION_M * WELD_PRECISION_M;
  for (const face of faces) {
    for (const loop of getFaceLoops(face)) {
      for (let i = 0; i < loop.length; i++) {
        const ia = loop[i];
        const ib = loop[(i + 1) % loop.length];
        const a = vertices[ia];
        const e = sub(vertices[ib], a);
        const lenSq = dot(e, e);
        if (lenSq <= tolSq) continue;
        const inserts = [];
        for (const vi of candidates) {
          if (vi === ia || vi === ib) continue;
          const d = sub(vertices[vi], a);
          const t = dot(d, e) / lenSq;
          if (t <= 0 || t >= 1) continue;
          const off = sub(d, { x: e.x * t, y: e.y * t, z: e.z * t });
          if (dot(off, off) > tolSq) continue;
          inserts.push({ t, vi });
        }
        if (inserts.length) {
          inserts.sort((i1, i2) => i1.t - i2.t);
          loop.splice(i + 1, 0, ...inserts.map((ins) => ins.vi));
          i += inserts.length;
        }
      }
    }
  }

  return cleanupMesh3d({ vertices, faces });
}
