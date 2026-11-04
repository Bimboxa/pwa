// Partition of a triangle subset by the dihedral angle between ADJACENT
// triangles: two triangles sharing a welded edge fall in the same part while
// the signed angle between their normals stays below `angleDeg`. Same
// predicate as faceHoverHighlight.getAngleRegions (union-find over the shared
// edges, signed dot so opposite-facing coincident triangles never join,
// degenerate triangles never join), on a plain soup instead of a
// BufferGeometry — the region clip (threedCutLines/clipRegionByCutLines)
// uses it with a tiny angle to split a curved region into its planar facets.
//
// Pure (no three.js): plain position arrays, directly replayable from node.

import { cross, dot, length, normalize, sub } from "./vec3Utils.js";

// Same quantization as faceHoverHighlight / splitTrisIntoComponents.
const WELD_PRECISION = 1e-4;

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - flat xyz array
 * @param {ArrayLike<number>|null} args.index - triangle index, or null (soup)
 * @param {number[]} args.tris - triangle indices of the region
 * @param {number} args.angleDeg - max dihedral angle joining two neighbors
 * @returns {{ parts: number[][], partOfTri: Map<number, number>,
 *   edges: Array<{ a: {x,y,z}, b: {x,y,z}, tris: number[] }> }}
 *   `parts` lists original triangle indices; `partOfTri` maps a triangle to
 *   its part index; `edges` lists every welded edge with the region triangles
 *   using it (shared edges have 2+ triangles).
 */
export default function partitionTrisByDihedralAngle({
  positions,
  index,
  tris,
  angleDeg,
}) {
  if (!positions || !tris?.length) {
    return { parts: [], partOfTri: new Map(), edges: [] };
  }
  const vertIndex = index ? (t, c) => index[3 * t + c] : (t, c) => 3 * t + c;
  const getPos = (vi) => ({
    x: positions[3 * vi],
    y: positions[3 * vi + 1],
    z: positions[3 * vi + 2],
  });

  const idByKey = new Map();
  const posById = [];
  const weldedId = (vi) => {
    const p = getPos(vi);
    const key = `${Math.round(p.x / WELD_PRECISION)},${Math.round(
      p.y / WELD_PRECISION
    )},${Math.round(p.z / WELD_PRECISION)}`;
    let id = idByKey.get(key);
    if (id === undefined) {
      id = posById.length;
      idByKey.set(key, id);
      posById.push(p);
    }
    return id;
  };

  const normals = new Array(tris.length);
  const edgeToLocal = new Map(); // key -> { a, b, locals: number[] }
  for (let local = 0; local < tris.length; local++) {
    const t = tris[local];
    const ids = [
      weldedId(vertIndex(t, 0)),
      weldedId(vertIndex(t, 1)),
      weldedId(vertIndex(t, 2)),
    ];
    const n = cross(
      sub(posById[ids[1]], posById[ids[0]]),
      sub(posById[ids[2]], posById[ids[0]])
    );
    normals[local] = length(n) > 0 ? normalize(n) : null;
    for (let e = 0; e < 3; e++) {
      const i0 = ids[e];
      const i1 = ids[(e + 1) % 3];
      if (i0 === i1) continue;
      const key = i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`;
      let entry = edgeToLocal.get(key);
      if (!entry) {
        entry = { a: i0 < i1 ? i0 : i1, b: i0 < i1 ? i1 : i0, locals: [] };
        edgeToLocal.set(key, entry);
      }
      entry.locals.push(local);
    }
  }

  const parent = new Int32Array(tris.length);
  for (let i = 0; i < tris.length; i++) parent[i] = i;
  const find = (i) => {
    let root = i;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]];
      root = parent[root];
    }
    return root;
  };
  const union = (i, j) => {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) return;
    if (ri < rj) parent[rj] = ri;
    else parent[ri] = rj;
  };

  const cosTol = Math.cos((Math.max(0, angleDeg) * Math.PI) / 180);
  for (const { locals } of edgeToLocal.values()) {
    if (locals.length < 2) continue;
    for (let i = 0; i < locals.length; i++) {
      const ni = normals[locals[i]];
      if (!ni) continue;
      for (let j = i + 1; j < locals.length; j++) {
        const nj = normals[locals[j]];
        if (!nj) continue;
        if (dot(ni, nj) >= cosTol) union(locals[i], locals[j]);
      }
    }
  }

  const partIndexOfRoot = new Map();
  const parts = [];
  const partOfTri = new Map();
  for (let local = 0; local < tris.length; local++) {
    const root = find(local);
    let partIndex = partIndexOfRoot.get(root);
    if (partIndex === undefined) {
      partIndex = parts.length;
      partIndexOfRoot.set(root, partIndex);
      parts.push([]);
    }
    parts[partIndex].push(tris[local]);
    partOfTri.set(tris[local], partIndex);
  }

  const edges = [];
  for (const { a, b, locals } of edgeToLocal.values()) {
    edges.push({
      a: posById[a],
      b: posById[b],
      tris: locals.map((local) => tris[local]),
    });
  }

  return { parts, partOfTri, edges };
}
