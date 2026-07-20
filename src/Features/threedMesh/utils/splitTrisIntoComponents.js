// Splits a triangle subset into edge-connected components (BFS over welded
// shared edges, restricted to the subset). CSG-carved geometries fragment a
// coplanar plane region into several components separated by T-junctions;
// extractRegionBoundaryLoops classifies the largest loop as THE contour and
// every other loop as a hole, so it must be fed one component at a time.
//
// Pure (no three.js): operates on plain position arrays in mesh-LOCAL
// coordinates, directly replayable from node scripts.

// Same quantization as extractRegionBoundaryLoops / faceHoverHighlight.
const WELD_PRECISION = 1e-4;

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - flat xyz array (Float32Array ok)
 * @param {ArrayLike<number>|null} args.index - triangle index, or null (soup)
 * @param {number[]} args.tris - triangle indices of the region
 * @returns {number[][]} edge-connected components (original tri indices)
 */
export default function splitTrisIntoComponents({ positions, index, tris }) {
  if (!positions || !tris?.length) return [];
  if (tris.length === 1) return [[...tris]];

  const vertIndex = index ? (t, c) => index[3 * t + c] : (t, c) => 3 * t + c;

  const idByKey = new Map();
  const weldedId = (vi) => {
    const key = `${Math.round(positions[3 * vi] / WELD_PRECISION)},${Math.round(
      positions[3 * vi + 1] / WELD_PRECISION
    )},${Math.round(positions[3 * vi + 2] / WELD_PRECISION)}`;
    let id = idByKey.get(key);
    if (id === undefined) {
      id = idByKey.size;
      idByKey.set(key, id);
    }
    return id;
  };

  // Edge map restricted to the subset: undirected welded edge -> local tri
  // indices (into `tris`).
  const edgeToLocal = new Map();
  const cornerIds = new Int32Array(3 * tris.length);
  for (let local = 0; local < tris.length; local++) {
    const t = tris[local];
    for (let c = 0; c < 3; c++) {
      cornerIds[3 * local + c] = weldedId(vertIndex(t, c));
    }
    for (let e = 0; e < 3; e++) {
      const i0 = cornerIds[3 * local + e];
      const i1 = cornerIds[3 * local + ((e + 1) % 3)];
      if (i0 === i1) continue; // degenerate edge
      const key = i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`;
      let list = edgeToLocal.get(key);
      if (!list) {
        list = [];
        edgeToLocal.set(key, list);
      }
      list.push(local);
    }
  }

  const componentOfLocal = new Int32Array(tris.length).fill(-1);
  const components = [];
  for (let seed = 0; seed < tris.length; seed++) {
    if (componentOfLocal[seed] >= 0) continue;
    const componentIndex = components.length;
    const component = [];
    const stack = [seed];
    componentOfLocal[seed] = componentIndex;
    while (stack.length) {
      const local = stack.pop();
      component.push(tris[local]);
      for (let e = 0; e < 3; e++) {
        const i0 = cornerIds[3 * local + e];
        const i1 = cornerIds[3 * local + ((e + 1) % 3)];
        if (i0 === i1) continue;
        const key = i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`;
        for (const neighbor of edgeToLocal.get(key) || []) {
          if (componentOfLocal[neighbor] >= 0) continue;
          componentOfLocal[neighbor] = componentIndex;
          stack.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  return components;
}
