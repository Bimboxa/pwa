import { cross, length, normalize, sub } from "./vec3Utils.js";

// Boundary of a triangle region, in 3D and without any planarity assumption:
// welds vertices, keeps the edges used by exactly one triangle, and walks them
// into closed loops. Shared by the planar path (extractRegionBoundaryLoops,
// which classifies the loops as one contour + holes in the region plane) and
// by the curved path (buildShellFromRegion, which keeps the loops as-is — a
// 360° revolution has two boundary circles and no "outer" contour at all).
//
// Pure (no three.js): operates on plain position arrays, directly replayable
// from node scripts.

// Same quantization as faceHoverHighlight.buildAdjacency: extrude-style
// geometries duplicate vertices per face; welding at 0.1 mm makes edges
// "shared" so interior edges cancel out.
const WELD_PRECISION = 1e-4;

// Collinear-vertex cleanup: tessellation inserts vertices along straight
// polygon edges; they are noise for cut tools (reference vertices must be
// real corners). A vertex is dropped when sin(angle between its two edges)
// is below this threshold (~0.006°) — far under any real corner, far above
// float32 position noise.
const COLLINEAR_SIN = 1e-4;

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - flat xyz array (Float32Array ok)
 * @param {ArrayLike<number>|null} args.index - triangle index, or null (soup)
 * @param {number[]} args.tris - triangle indices of the region
 * @returns {{loops: [[{x,y,z}]], normal: {x,y,z}} | null} open loops (no
 *   closing duplicate), collinear vertices removed. `normal` is the geometric
 *   normal of the region's first non-degenerate triangle.
 */
export default function extractBoundaryLoops3d({ positions, index, tris }) {
  if (!positions || !tris?.length) return null;

  const vertIndex = index ? (t, c) => index[3 * t + c] : (t, c) => 3 * t + c;
  const getPos = (vi) => ({
    x: positions[3 * vi],
    y: positions[3 * vi + 1],
    z: positions[3 * vi + 2],
  });

  // 1. Weld vertices by quantized position; keep one representative position
  // per welded id.
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

  // 2. Count undirected edge usage over the region, remembering the DIRECTED
  // first occurrence (triangle winding) so loops come out consistently
  // oriented (CCW around the region normal for an outer contour, CW for a
  // hole, assuming consistent winding — which regions have, since
  // getFaceRegion joins on the SIGNED normal).
  let normal = null;
  const edgeUse = new Map(); // undirectedKey -> {count, a, b}
  for (const t of tris) {
    const ids = [
      weldedId(vertIndex(t, 0)),
      weldedId(vertIndex(t, 1)),
      weldedId(vertIndex(t, 2)),
    ];

    if (!normal) {
      const pa = posById[ids[0]];
      const pb = posById[ids[1]];
      const pc = posById[ids[2]];
      const n = cross(sub(pb, pa), sub(pc, pa));
      if (length(n) > 0) normal = normalize(n);
    }

    for (let e = 0; e < 3; e++) {
      const a = ids[e];
      const b = ids[(e + 1) % 3];
      if (a === b) continue; // degenerate edge
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const use = edgeUse.get(key);
      if (use) use.count++;
      else edgeUse.set(key, { count: 1, a, b });
    }
  }
  if (!normal) return null;

  // 3. Boundary edges = used by exactly one triangle. Index them by start
  // vertex (directed, per winding).
  const outgoing = new Map(); // startId -> [{a, b, used}]
  let boundaryCount = 0;
  for (const use of edgeUse.values()) {
    if (use.count !== 1) continue;
    boundaryCount++;
    let list = outgoing.get(use.a);
    if (!list) {
      list = [];
      outgoing.set(use.a, list);
    }
    list.push({ a: use.a, b: use.b, used: false });
  }
  if (boundaryCount < 3) return null;

  // 4. Walk directed boundary edges into closed loops.
  const loops = [];
  for (const list of outgoing.values()) {
    for (const startEdge of list) {
      if (startEdge.used) continue;
      const loop = [];
      let edge = startEdge;
      while (edge && !edge.used) {
        edge.used = true;
        loop.push(edge.a);
        const nextList = outgoing.get(edge.b);
        edge = nextList?.find((e) => !e.used && e.b !== loop[loop.length - 1]);
        // Fall back to any unused edge (pinch vertex) — including a
        // back-track if that is all that remains.
        if (!edge) edge = nextList?.find((e) => !e.used);
      }
      if (loop.length >= 3) loops.push(loop.map((id) => posById[id]));
    }
  }

  const cleaned = loops
    .map((loop) => removeCollinearVertices(loop))
    .filter((loop) => loop.length >= 3);
  if (!cleaned.length) return null;

  return { loops: cleaned, normal };
}

function removeCollinearVertices(loop) {
  if (loop.length < 3) return loop;
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const prev = loop[(i - 1 + loop.length) % loop.length];
    const p = loop[i];
    const next = loop[(i + 1) % loop.length];
    const e1 = sub(p, prev);
    const e2 = sub(next, p);
    const l1 = length(e1);
    const l2 = length(e2);
    if (l1 === 0) continue; // duplicate point
    if (l2 === 0) continue;
    const sin = length(cross(e1, e2)) / (l1 * l2);
    if (sin > COLLINEAR_SIN) out.push(p);
  }
  return out;
}
