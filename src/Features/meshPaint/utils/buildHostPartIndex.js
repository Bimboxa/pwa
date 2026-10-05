import coalesceCoplanarFaces from "../../threedMesh/utils/coalesceCoplanarFaces.js";
import extractRegionBoundaryLoops from "../../threedMesh/utils/extractRegionBoundaryLoops.js";
import getPolygonLabelPoint from "../../threedMesh/utils/getPolygonLabelPoint.js";
import splitTrisIntoComponents from "../../threedMesh/utils/splitTrisIntoComponents.js";
import {
  cross,
  dot,
  length,
  normalize,
  scale,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";
import {
  BRUSH_FACE_ANGLE_DEG,
  EDGE_COLLINEAR_DEG,
  INSIDE_PROBE_M,
} from "../constants/meshPaintConstants.js";

import hashTriangles from "./hashTriangles.js";
import { createInsideSoupTester } from "./isPointInsideSoup.js";
import {
  computeFaceBasis,
  faceArea,
  faceCentroid,
  flipFace,
  getFaceNewellNormal,
  orientFaceLoops,
  projectPoint,
  toV,
  unprojectPoint,
} from "./meshPaintGeometry.js";

// Paintable parts of ONE host, from its displayed triangles (base-map-LOCAL
// meters, z absolute, 9 numbers per triangle — the three adapter of the
// integration flattens the host's SOLID meshes):
//
//   islands: planar facets (connected coplanar regions, angle ≤
//     BRUSH_FACE_ANGLE_DEG) as polygons with holes — with `exactFaces` (an
//     isMesh3d host's stored faces, same frame) the islands are those faces;
//   chains: maximal straight feature edges (borders, or creases > ~5° —
//     useVertexSnap.buildIndex's rule), merged within EDGE_COLLINEAR_DEG,
//     with the normals of the islands they border (`sides`);
//   isClosed: the soup is a closed solid (CSG T-junctions repaired, only
//     pinhole-sized border edges tolerated — see CLOSED_MAX_BORDER_M);
//   island normals: OUTWARD on a closed host (ray parity), otherwise a
//     deterministic orientation (+z, then +y, then +x first);
//   hash: hashTriangles(triangles);
//   getSurfaces(angleDeg): smooth surfaces — islands joined across the edges
//     they share while the fold between NEIGHBORS stays below angleDeg
//     (getFaceRegion's rule: a tessellated curved wall, a lathe, is one
//     surface), with a consistent orientation on open hosts;
//   getCurves(angleDeg): chains joined end to end while the turn at the
//     shared vertex stays below angleDeg and the curve stays planar.
//   Both are lazy and memoized per angle: islands / chains never change.
//
// Robust to inconsistent windings (extrudeClosedShape), float32 CSG noise
// (sliver / needle triangles, T-junctions) and internal partitions of
// abutting pieces (coincident opposite copies cancel out).
//
// Pure (no three.js): node-testable.

const toRad = (deg) => (deg * Math.PI) / 180;

// Same vertex below this distance (codebase-wide weld).
const WELD_M = 1e-4;
// Plane grouping: offset slack (m) and the angle of a "reliable" triangle.
const PLANE_TOL_M = 5e-4;
const COS_FACE = Math.cos(toRad(BRUSH_FACE_ANGLE_DEG));
// Triangles thinner than this (altitude, m) carry a float32-noisy normal:
// they join the plane of a neighbor their vertices lie on.
const RELIABLE_ALTITUDE_M = 2e-3;
// Thinner still: a needle (collinear vertices). Never part of an island
// (T-junction bridges), only of the topology.
const NEEDLE_ALTITUDE_M = 1e-5;
// Normal-direction bucket of the plane lookup (≈ 1.15°).
const NORMAL_CELL = 0.02;
// Feature edge: the two sides' normals differ by more than ~5° (|dot|).
const COS_FEATURE = 0.9962;
const COS_COLLINEAR = Math.cos(toRad(EDGE_COLLINEAR_DEG));
// T-junction repair: a vertex this close to a border edge splits it.
const T_JUNCTION_TOL_M = 2 * WELD_M;
const T_JUNCTION_MAX_TESTS = 2e7;
// Closed solid: the (T-junction repaired) border edges add up to at most
// max(CLOSED_MAX_BORDER_M, CLOSED_BORDER_LENGTH_RATIO × total edge length) —
// a CSG pinhole is tolerated, any real opening is not (an edge-count ratio
// would call a dense open sheet "closed").
const CLOSED_MAX_BORDER_M = 0.05;
const CLOSED_BORDER_LENGTH_RATIO = 1e-3;
const MIN_ISLAND_AREA_M2 = 1e-6;
const MIN_CHAIN_LENGTH_M = 1e-4;
// A chain borders an island lying within this distance (plane and boundary).
const CHAIN_SIDE_TOL_M = 1e-3;
const ORIENT_EPS = 1e-9;

// --- parsing ---

function parseTriangles(triangles) {
  const triCount = Math.floor((triangles?.length || 0) / 9);
  const idByKey = new Map();
  const positions = []; // welded representative positions
  const weld = (x, y, z) => {
    const key = `${Math.round(x / WELD_M)},${Math.round(y / WELD_M)},${Math.round(
      z / WELD_M
    )}`;
    let id = idByKey.get(key);
    if (id === undefined) {
      id = positions.length;
      idByKey.set(key, id);
      positions.push({ x, y, z });
    }
    return id;
  };

  const tris = [];
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let t = 0; t < triCount; t++) {
    const o = 9 * t;
    const v = [0, 1, 2].map((c) => ({
      x: Number(triangles[o + 3 * c]),
      y: Number(triangles[o + 3 * c + 1]),
      z: Number(triangles[o + 3 * c + 2]),
    }));
    for (const p of v) {
      if (p.x < min.x) min.x = p.x;
      if (p.y < min.y) min.y = p.y;
      if (p.z < min.z) min.z = p.z;
      if (p.x > max.x) max.x = p.x;
      if (p.y > max.y) max.y = p.y;
      if (p.z > max.z) max.z = p.z;
    }
    const ids = v.map((p) => weld(p.x, p.y, p.z));
    if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
    const raw = cross(sub(v[1], v[0]), sub(v[2], v[0]));
    const area2 = length(raw);
    const longest = Math.max(
      length(sub(v[1], v[0])),
      length(sub(v[2], v[1])),
      length(sub(v[0], v[2]))
    );
    const altitude = longest > 0 ? area2 / longest : 0;
    tris.push({
      t,
      v,
      ids,
      area2,
      altitude,
      normal: area2 > 0 ? scale(raw, 1 / area2) : null,
      centroid: scale(
        {
          x: v[0].x + v[1].x + v[2].x,
          y: v[0].y + v[1].y + v[2].y,
          z: v[0].z + v[1].z + v[2].z,
        },
        1 / 3
      ),
      group: null,
    });
  }
  const box = Number.isFinite(min.x)
    ? { min, max }
    : { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  return { tris, positions, box };
}

// --- plane groups ---

// Integer key of a normal-direction cell (components in [-1, 1] → cell
// indices within ±50, packed in base 128).
const CELL_BASE = 128;
const CELL_OFFSET = 64;
const cellKey = (cx, cy, cz) =>
  ((cx + CELL_OFFSET) * CELL_BASE + (cy + CELL_OFFSET)) * CELL_BASE +
  (cz + CELL_OFFSET);
const cellOf = (n, sign) => [
  Math.round((sign * n.x) / NORMAL_CELL),
  Math.round((sign * n.y) / NORMAL_CELL),
  Math.round((sign * n.z) / NORMAL_CELL),
];

function maxPlaneDistance(tri, group) {
  let max = 0;
  for (const p of tri.v) {
    const d = Math.abs(dot(group.n, p) - group.d);
    if (d > max) max = d;
  }
  return max;
}

function buildPlaneGroups(tris) {
  const groups = [];
  const groupsByCell = new Map();
  const groupsByVertex = new Map(); // welded id -> Set<group>

  const addToGroup = (tri, group) => {
    tri.group = group;
    group.tris.push(tri);
    for (const id of tri.ids) {
      let set = groupsByVertex.get(id);
      if (!set) {
        set = new Set();
        groupsByVertex.set(id, set);
      }
      set.add(group);
    }
  };
  const createGroup = (tri) => {
    const n = tri.normal;
    const group = { n, d: dot(n, tri.centroid), tris: [] };
    groups.push(group);
    const key = cellKey(...cellOf(n, 1));
    if (!groupsByCell.has(key)) groupsByCell.set(key, []);
    groupsByCell.get(key).push(group);
    addToGroup(tri, group);
  };
  const lookupByNormal = (tri) => {
    const found = [];
    for (const sign of [1, -1]) {
      const [cx, cy, cz] = cellOf(tri.normal, sign);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const list = groupsByCell.get(cellKey(cx + dx, cy + dy, cz + dz));
            if (list) found.push(...list);
          }
        }
      }
    }
    return found;
  };

  // Pass 1: reliable triangles, largest first (the biggest triangle of a
  // plane seeds it: its normal is the least noisy).
  const reliable = tris
    .filter((tri) => tri.normal && tri.altitude >= RELIABLE_ALTITUDE_M)
    .sort((a, b) => b.area2 - a.area2 || a.t - b.t);
  for (const tri of reliable) {
    let match = null;
    for (const group of lookupByNormal(tri)) {
      if (Math.abs(dot(tri.normal, group.n)) < COS_FACE) continue;
      if (Math.abs(dot(group.n, tri.centroid) - group.d) > PLANE_TOL_M)
        continue;
      match = group;
      break;
    }
    if (match) addToGroup(tri, match);
    else createGroup(tri);
  }

  // Pass 2: slivers and needles join a plane of a vertex neighbor when their
  // three vertices lie on it.
  const thin = tris.filter(
    (tri) => !tri.group && tri.altitude < RELIABLE_ALTITUDE_M
  );
  for (const tri of thin) {
    let best = null;
    let bestDist = PLANE_TOL_M;
    for (const id of tri.ids) {
      for (const group of groupsByVertex.get(id) || []) {
        const d = maxPlaneDistance(tri, group);
        if (d <= bestDist) {
          bestDist = d;
          best = group;
        }
      }
    }
    if (best) addToGroup(tri, best);
    else if (tri.normal && tri.altitude >= NEEDLE_ALTITUDE_M) createGroup(tri);
  }

  return groups;
}

// --- islands ---

// Winding of a group triangle about the group normal. A needle's own normal
// is noise: it never enters an island (see NEEDLE_ALTITUDE_M).
function groupSoup(group) {
  const members = group.tris.filter(
    (tri) => tri.altitude >= NEEDLE_ALTITUDE_M && tri.normal
  );
  const positions = new Float64Array(9 * members.length);
  members.forEach((tri, i) => {
    const order = dot(tri.normal, group.n) < 0 ? [0, 2, 1] : [0, 1, 2];
    order.forEach((c, k) => {
      positions[9 * i + 3 * k] = tri.v[c].x;
      positions[9 * i + 3 * k + 1] = tri.v[c].y;
      positions[9 * i + 3 * k + 2] = tri.v[c].z;
    });
  });
  return { positions, tris: members.map((_, i) => i) };
}

function islandsFromGroups(groups) {
  const islands = [];
  for (const group of groups) {
    const soup = groupSoup(group);
    if (!soup.tris.length) continue;
    const faces = [];
    for (const component of splitTrisIntoComponents({
      positions: soup.positions,
      index: null,
      tris: soup.tris,
    })) {
      const loops = extractRegionBoundaryLoops({
        positions: soup.positions,
        index: null,
        tris: component,
      });
      if (!loops) continue;
      // Loops come CCW about the component's first triangle normal, which
      // was re-wound toward the group normal.
      faces.push({
        contour: loops.contour,
        holes: loops.holes,
        normal: group.n,
      });
    }
    const merged = faces.length > 1 ? coalesceCoplanarFaces(faces) : faces;
    for (const face of merged) {
      islands.push(
        orientFaceLoops({
          polygons: [{ contour: face.contour, holes: face.holes || [] }],
          normal: group.n,
        })
      );
    }
  }
  return islands;
}

function islandsFromExactFaces(exactFaces) {
  const islands = [];
  for (const face of exactFaces || []) {
    if (!(face?.contour?.length >= 3)) continue;
    const polygons = [
      {
        contour: face.contour.map(toV),
        holes: (face.holes || [])
          .filter((hole) => hole?.length >= 3)
          .map((hole) => hole.map(toV)),
      },
    ];
    const normal = getFaceNewellNormal({ polygons });
    if (!normal) continue;
    islands.push(orientFaceLoops({ polygons, normal }));
  }
  return islands;
}

// A point ON the material of an island (the centroid of a ring or of a U
// lies in the void).
function getIslandInteriorPoint(island) {
  let best = null;
  let bestArea = -1;
  for (const polygon of island.polygons) {
    const area = faceArea({ polygons: [polygon], normal: island.normal });
    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }
  if (!best) return null;
  const basis = computeFaceBasis(island.normal, best.contour[0]);
  const to2d = (p) => {
    const [x, y] = projectPoint(p, basis);
    return { x, y };
  };
  const p = getPolygonLabelPoint(
    best.contour.map(to2d),
    best.holes.map((hole) => hole.map(to2d))
  );
  return unprojectPoint([p.x, p.y], basis);
}

function isCanonicalNormal(n) {
  if (Math.abs(n.z) > ORIENT_EPS) return n.z > 0;
  if (Math.abs(n.y) > ORIENT_EPS) return n.y > 0;
  return n.x >= 0;
}

// --- topology: closedness + feature edges ---

function buildEdgeMap(tris) {
  const edges = new Map(); // "a_b" (a < b) -> {a, b, tris: []}
  const add = (a, b, tri) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = `${lo}_${hi}`;
    let edge = edges.get(key);
    if (!edge) {
      edge = { a: lo, b: hi, tris: [] };
      edges.set(key, edge);
    }
    edge.tris.push(tri);
  };
  for (const tri of tris) {
    if (!tri.group) continue;
    for (let e = 0; e < 3; e++) add(tri.ids[e], tri.ids[(e + 1) % 3], tri);
  }
  return { edges, add };
}

// CSG T-junctions: a vertex lying inside a border edge splits it, so the
// pieces pair with the other side's edges.
function repairTJunctions(edgeMap, positions) {
  const { edges, add } = edgeMap;
  const border = [...edges.entries()].filter(([, e]) => e.tris.length === 1);
  if (!border.length) return;
  const ids = [...new Set(border.flatMap(([, e]) => [e.a, e.b]))].sort(
    (i, j) => positions[i].x - positions[j].x
  );
  if (border.length * ids.length > T_JUNCTION_MAX_TESTS) return;
  const xs = ids.map((id) => positions[id].x);
  const lowerBound = (x) => {
    let lo = 0;
    let hi = xs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const tolSq = T_JUNCTION_TOL_M * T_JUNCTION_TOL_M;
  for (const [key, edge] of border) {
    // Already paired by an earlier split of the other side.
    if (edges.get(key) !== edge || edge.tris.length !== 1) continue;
    const A = positions[edge.a];
    const B = positions[edge.b];
    const e = sub(B, A);
    const lenSq = dot(e, e);
    if (lenSq <= tolSq) continue;
    const inserts = [];
    const xMin = Math.min(A.x, B.x) - T_JUNCTION_TOL_M;
    const xMax = Math.max(A.x, B.x) + T_JUNCTION_TOL_M;
    for (let k = lowerBound(xMin); k < ids.length && xs[k] <= xMax; k++) {
      const id = ids[k];
      if (id === edge.a || id === edge.b) continue;
      const d = sub(positions[id], A);
      const t = dot(d, e) / lenSq;
      if (t <= 0 || t >= 1) continue;
      const off = sub(d, scale(e, t));
      if (dot(off, off) > tolSq) continue;
      inserts.push({ t, id });
    }
    if (!inserts.length) continue;
    inserts.sort((i1, i2) => i1.t - i2.t);
    edges.delete(key);
    const chain = [edge.a, ...inserts.map((ins) => ins.id), edge.b];
    for (let i = 0; i + 1 < chain.length; i++) {
      if (chain[i] === chain[i + 1]) continue;
      for (const tri of edge.tris) add(chain[i], chain[i + 1], tri);
    }
  }
}

function isFeatureEdge(edge) {
  if (edge.tris.length === 1) return true;
  const n0 = edge.tris[0].group.n;
  return edge.tris.some((tri) => Math.abs(dot(n0, tri.group.n)) < COS_FEATURE);
}

// Maximal straight runs of feature edges: from every unvisited edge, both
// ends walk through vertices with a straight continuation (direction within
// EDGE_COLLINEAR_DEG of the seed edge).
function buildChains(featureEdges, positions) {
  const incident = new Map(); // vertex id -> edges
  for (const edge of featureEdges) {
    for (const id of [edge.a, edge.b]) {
      if (!incident.has(id)) incident.set(id, []);
      incident.get(id).push(edge);
    }
  }
  const visited = new Set();
  const extend = (startId, dir) => {
    let current = startId;
    for (;;) {
      const origin = positions[current];
      let best = null;
      let bestNext = null;
      let bestDist = 0;
      for (const edge of incident.get(current) || []) {
        if (visited.has(edge)) continue;
        const next = edge.a === current ? edge.b : edge.a;
        const d = sub(positions[next], origin);
        const dist = length(d);
        if (dist === 0 || dot(d, dir) / dist < COS_COLLINEAR) continue;
        if (dist > bestDist) {
          bestDist = dist;
          best = edge;
          bestNext = next;
        }
      }
      if (!best) return current;
      visited.add(best);
      current = bestNext;
    }
  };

  const chains = [];
  for (const edge of featureEdges) {
    if (visited.has(edge)) continue;
    visited.add(edge);
    const dir = normalize(sub(positions[edge.b], positions[edge.a]));
    if (length(dir) === 0) continue;
    const end = extend(edge.b, dir);
    const start = extend(edge.a, scale(dir, -1));
    const a = toV(positions[start]);
    const b = toV(positions[end]);
    const len = length(sub(b, a));
    if (len > MIN_CHAIN_LENGTH_M) chains.push({ points: [a, b], length: len });
  }
  return chains;
}

// Sides of a chain: the (oriented) normals of the islands it borders — the
// "material wedge" of an edge. The re-sync of a painted edge uses them to
// tell the top edge of a slab from its bottom edge once the slab got
// thicker (both are parallel, both lie in the front plane).
function isNearLoops([px, py], loops, tol) {
  const tolSq = tol * tol;
  for (const loop of loops) {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = loop[i];
      const [bx, by] = loop[(i + 1) % n];
      const ex = bx - ax;
      const ey = by - ay;
      const lenSq = ex * ex + ey * ey;
      let t = lenSq > 0 ? ((px - ax) * ex + (py - ay) * ey) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const dx = px - (ax + t * ex);
      const dy = py - (ay + t * ey);
      if (dx * dx + dy * dy <= tolSq) return true;
    }
  }
  return false;
}

function attachChainSides(chains, islands) {
  const prepared = islands.map((island) => {
    const points = island.polygons.flatMap((polygon) => [
      ...polygon.contour,
      ...polygon.holes.flat(),
    ]);
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const p of points) {
      for (const k of ["x", "y", "z"]) {
        if (p[k] < min[k]) min[k] = p[k];
        if (p[k] > max[k]) max[k] = p[k];
      }
    }
    const basis = computeFaceBasis(island.normal, points[0]);
    return {
      normal: island.normal,
      d: dot(island.normal, island.centroid),
      min,
      max,
      basis,
      loops: island.polygons.flatMap((polygon) =>
        [polygon.contour, ...polygon.holes].map((loop) =>
          loop.map((p) => projectPoint(p, basis))
        )
      ),
    };
  });
  const tol = CHAIN_SIDE_TOL_M;
  for (const chain of chains) {
    const [a, b] = chain.points;
    const samples = [0.25, 0.5, 0.75].map((t) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    }));
    chain.sides = [];
    for (const island of prepared) {
      const outside = ["x", "y", "z"].some(
        (k) =>
          Math.max(a[k], b[k]) < island.min[k] - tol ||
          Math.min(a[k], b[k]) > island.max[k] + tol
      );
      if (outside) continue;
      if (Math.abs(dot(island.normal, a) - island.d) > tol) continue;
      if (Math.abs(dot(island.normal, b) - island.d) > tol) continue;
      const borders = samples.some((p) =>
        isNearLoops(projectPoint(p, island.basis), island.loops, tol)
      );
      if (borders) chain.sides.push(toV(island.normal));
    }
  }
  return chains;
}

// --- smooth surfaces ---

// A triangle belongs to the island of its plane that holds its centroid.
const COS_ISLAND = Math.cos(toRad(1));
const ISLAND_PLANE_TOL_M = 2e-3;

function isInsideLoop2d([px, py], loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i];
    const [xj, yj] = loop[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function createIslandLocator(islands) {
  const byCell = new Map();
  const prepared = islands.map((island, index) => {
    const origin = island.polygons[0].contour[0];
    const basis = computeFaceBasis(island.normal, origin);
    const key = cellKey(...cellOf(island.normal, 1));
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(index);
    return {
      normal: island.normal,
      d: dot(island.normal, origin),
      basis,
      polygons: island.polygons.map((polygon) => ({
        contour: polygon.contour.map((p) => projectPoint(p, basis)),
        holes: polygon.holes.map((hole) =>
          hole.map((p) => projectPoint(p, basis))
        ),
      })),
    };
  });
  return (tri) => {
    const n = tri.group?.n;
    if (!n) return -1;
    let best = -1;
    let bestDist = ISLAND_PLANE_TOL_M;
    for (const sign of [1, -1]) {
      const [cx, cy, cz] = cellOf(n, sign);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            for (const index of byCell.get(
              cellKey(cx + dx, cy + dy, cz + dz)
            ) || []) {
              const island = prepared[index];
              if (Math.abs(dot(n, island.normal)) < COS_ISLAND) continue;
              const dist = Math.abs(
                dot(island.normal, tri.centroid) - island.d
              );
              if (dist > bestDist) continue;
              const p = projectPoint(tri.centroid, island.basis);
              const inside = island.polygons.some(
                (polygon) =>
                  isInsideLoop2d(p, polygon.contour) &&
                  !polygon.holes.some((hole) => isInsideLoop2d(p, hole))
              );
              if (!inside) continue;
              best = index;
              bestDist = dist;
            }
          }
        }
      }
    }
    return best;
  };
}

// Islands sharing an edge: [{i, j, cos, sameSpin}] — cos = cosine of the
// fold between the two (1 = flat continuation), from the in-plane directions
// leaving the edge toward each island (orientation-free: island normals of
// an open host are not consistent); sameSpin: the two normals are NOT on the
// same side of the folded sheet (one of the islands must be flipped).
function buildIslandPairs(tris, edgeMap, positions, islands) {
  const locate = createIslandLocator(islands);
  const islandOfTri = new Map();
  const islandOf = (tri) => {
    let index = islandOfTri.get(tri);
    if (index === undefined) {
      index = tri.altitude >= NEEDLE_ALTITUDE_M ? locate(tri) : -1;
      islandOfTri.set(tri, index);
    }
    return index;
  };
  const pairs = new Map();
  for (const edge of edgeMap.edges.values()) {
    if (edge.tris.length < 2) continue;
    const a = positions[edge.a];
    const e = normalize(sub(positions[edge.b], a));
    if (length(e) === 0) continue;
    const sides = [];
    for (const tri of edge.tris) {
      const index = islandOf(tri);
      if (index < 0) continue;
      const across = cross(islands[index].normal, e);
      const toward = dot(across, sub(tri.centroid, a));
      if (Math.abs(toward) < NEEDLE_ALTITUDE_M) continue;
      const spin = toward > 0 ? 1 : -1;
      sides.push({ index, u: scale(across, spin), spin });
    }
    for (let k = 0; k < sides.length; k++) {
      for (let l = k + 1; l < sides.length; l++) {
        const [s1, s2] =
          sides[k].index < sides[l].index
            ? [sides[k], sides[l]]
            : [sides[l], sides[k]];
        if (s1.index === s2.index) continue;
        const key = `${s1.index}_${s2.index}`;
        const cos = -dot(s1.u, s2.u);
        const known = pairs.get(key);
        if (known && known.cos >= cos) continue;
        pairs.set(key, {
          i: s1.index,
          j: s2.index,
          cos,
          sameSpin: s1.spin === s2.spin,
        });
      }
    }
  }
  return [...pairs.values()];
}

function buildSurfaces(pairs, islandCount, angleDeg, isClosed) {
  const parent = Array.from({ length: islandCount }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const cosMin = Math.cos(toRad(Math.max(0, Math.min(180, angleDeg))));
  const neighbors = Array.from({ length: islandCount }, () => []);
  if (angleDeg > 0) {
    for (const pair of pairs) {
      if (pair.cos < cosMin) continue;
      parent[find(pair.i)] = find(pair.j);
      neighbors[pair.i].push({ to: pair.j, flip: pair.sameSpin });
      neighbors[pair.j].push({ to: pair.i, flip: pair.sameSpin });
    }
  }
  const surfaceOfIsland = new Array(islandCount);
  const surfaces = [];
  const idByRoot = new Map();
  for (let i = 0; i < islandCount; i++) {
    const root = find(i);
    if (!idByRoot.has(root)) {
      idByRoot.set(root, surfaces.length);
      surfaces.push([]);
    }
    surfaceOfIsland[i] = idByRoot.get(root);
    surfaces[surfaceOfIsland[i]].push(i);
  }
  // Open host: one orientation per surface, spread from its first island
  // (a closed host's islands are all outward already).
  const flipOfIsland = new Array(islandCount).fill(false);
  if (!isClosed) {
    const seen = new Array(islandCount).fill(false);
    for (const surface of surfaces) {
      const stack = [surface[0]];
      seen[surface[0]] = true;
      while (stack.length) {
        const i = stack.pop();
        for (const { to, flip } of neighbors[i]) {
          if (seen[to]) continue;
          seen[to] = true;
          flipOfIsland[to] = flipOfIsland[i] !== flip;
          stack.push(to);
        }
      }
    }
  }
  return { surfaces, surfaceOfIsland, flipOfIsland };
}

// --- curves ---

// A curve stays within this distance (m) of its plane.
const CURVE_PLANE_TOL_M = 1e-3;
const SIN_COLLINEAR = Math.sin(toRad(EDGE_COLLINEAR_DEG));
const COS_SAME_SIDE = Math.cos(toRad(1));

const weldKey = (p) =>
  `${Math.round(p.x / WELD_M)},${Math.round(p.y / WELD_M)},${Math.round(
    p.z / WELD_M
  )}`;

function commonSides(chains) {
  const [first, ...others] = chains;
  return (first.sides || []).filter((side) =>
    others.every((chain) =>
      (chain.sides || []).some((other) => dot(side, other) >= COS_SAME_SIDE)
    )
  );
}

function buildCurves(chains, angleDeg) {
  const cosMin = Math.cos(toRad(Math.max(0, Math.min(180, angleDeg))));
  // Chain ends meeting at each vertex; `out`: unit direction leaving it.
  const endsByVertex = new Map();
  chains.forEach((chain, index) => {
    for (const end of [0, 1]) {
      const at = chain.points[end];
      const key = weldKey(at);
      if (!endsByVertex.has(key)) endsByVertex.set(key, []);
      endsByVertex.get(key).push({
        chain: index,
        end,
        out: normalize(sub(chain.points[1 - end], at)),
      });
    }
  });
  // link[chain][end]: the chain end it continues into (mutual best turn
  // below the angle).
  const link = chains.map(() => [null, null]);
  if (angleDeg > 0) {
    for (const ends of endsByVertex.values()) {
      if (ends.length < 2) continue;
      const bestOf = ends.map((from, k) => {
        let best = -1;
        let bestCos = cosMin;
        ends.forEach((to, l) => {
          if (l === k || to.chain === from.chain) return;
          const cos = -dot(from.out, to.out);
          if (cos >= bestCos) {
            bestCos = cos;
            best = l;
          }
        });
        return best;
      });
      bestOf.forEach((l, k) => {
        if (l < 0 || bestOf[l] !== k) return;
        link[ends[k].chain][ends[k].end] = {
          chain: ends[l].chain,
          end: ends[l].end,
        };
      });
    }
  }

  const curves = [];
  const curveOfChain = new Array(chains.length).fill(-1);
  const pushCurve = (points, members) => {
    let total = 0;
    for (let i = 0; i + 1 < points.length; i++) {
      total += length(sub(points[i + 1], points[i]));
    }
    for (const index of members) curveOfChain[index] = curves.length;
    curves.push({
      points,
      length: total,
      sides: commonSides(members.map((index) => chains[index])),
      chains: members,
    });
  };

  const visited = new Array(chains.length).fill(false);
  chains.forEach((_, seed) => {
    if (visited[seed]) return;
    visited[seed] = true;
    // Oriented run: {chain, from} = traveled from points[from].
    const run = [{ chain: seed, from: 0 }];
    let closed = false;
    for (let exit = 1, current = seed; ; ) {
      const next = link[current][exit];
      if (!next) break;
      if (next.chain === seed) {
        closed = true;
        break;
      }
      if (visited[next.chain]) break;
      visited[next.chain] = true;
      run.push({ chain: next.chain, from: next.end });
      current = next.chain;
      exit = 1 - next.end;
    }
    if (!closed) {
      for (let exit = 0, current = seed; ; ) {
        const next = link[current][exit];
        if (!next || visited[next.chain]) break;
        visited[next.chain] = true;
        run.unshift({ chain: next.chain, from: 1 - next.end });
        current = next.chain;
        exit = 1 - next.end;
      }
    }

    // Planar pieces of the run.
    let points = [];
    let members = [];
    let plane = null;
    for (const { chain, from } of run) {
      const a = chains[chain].points[from];
      const b = chains[chain].points[1 - from];
      if (points.length >= 2) {
        const origin = points[0];
        if (!plane) {
          const n = cross(
            normalize(sub(points[1], origin)),
            normalize(sub(b, a))
          );
          if (length(n) > SIN_COLLINEAR) plane = normalize(n);
        } else if (Math.abs(dot(plane, sub(b, origin))) > CURVE_PLANE_TOL_M) {
          pushCurve(points, members);
          points = [];
          members = [];
          plane = null;
        }
      }
      if (!points.length) points.push(a);
      points.push(b);
      members.push(chain);
    }
    pushCurve(points, members);
  });
  return { curves, curveOfChain };
}

// --- main ---

// Smallest probe offset of probeNormalSide (above the weld / plane
// tolerances of the soup).
const MIN_INSIDE_PROBE_M = 3e-4;

/**
 * Which way a facet normal points on a closed solid, robust to thin solids:
 * the two points `point ± ε·normal` are tested, ε halving from
 * INSIDE_PROBE_M, until exactly one of them is inside (a single 5 mm probe
 * exits a 3 mm membrane through its opposite face and reads "outside").
 *
 * @param {{x, y, z}} point - on the facet (or its plane)
 * @param {{x, y, z}} normal - unit
 * @param {(p: {x, y, z}) => boolean} isInside
 * @returns {1 | -1 | 0} 1 = outward, -1 = inward, 0 = undetermined
 */
export function probeNormalSide(point, normal, isInside) {
  for (let eps = INSIDE_PROBE_M; eps >= MIN_INSIDE_PROBE_M; eps /= 2) {
    const along = (sign) => ({
      x: point.x + normal.x * eps * sign,
      y: point.y + normal.y * eps * sign,
      z: point.z + normal.z * eps * sign,
    });
    const plus = isInside(along(1));
    const minus = isInside(along(-1));
    if (plus !== minus) return plus ? -1 : 1;
  }
  return 0;
}

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.triangles - local meters, 9 per triangle
 * @param {Array<{contour, holes}>} [args.exactFaces] - isMesh3d faces (same
 *   frame): the islands are exactly these faces
 * @returns {{islands: Array<{polygons, normal, centroid, area}>,
 *   chains: Array<{points: [V, V], length, sides: V[]}>, isClosed: boolean,
 *   box: {min: V, max: V}, hash: string,
 *   getSurfaces: (angleDeg) => {surfaces: number[][], surfaceOfIsland:
 *   number[], flipOfIsland: boolean[]},
 *   getCurves: (angleDeg) => {curves: Array<{points: V[], length, sides: V[],
 *   chains: number[]}>, curveOfChain: number[]}}} — chain.sides: normals
 *   (same orientation as the islands) of the islands the chain borders;
 *   surfaces: island indexes (flipOfIsland: islands to flip for one
 *   orientation per surface, open hosts); curves: polylines (closed: first
 *   point repeated) with the sides common to all their chains.
 */
export default function buildHostPartIndex({ triangles, exactFaces } = {}) {
  const { tris, positions, box } = parseTriangles(triangles);
  const groups = buildPlaneGroups(tris);

  // Topology (every grouped triangle, needles included: they bridge
  // T-junctions; each side's normal is its plane's).
  const edgeMap = buildEdgeMap(tris);
  repairTJunctions(edgeMap, positions);
  let borderLength = 0;
  let totalLength = 0;
  const featureEdges = [];
  for (const edge of edgeMap.edges.values()) {
    const edgeLength = length(sub(positions[edge.b], positions[edge.a]));
    totalLength += edgeLength;
    if (edge.tris.length === 1) borderLength += edgeLength;
    if (isFeatureEdge(edge)) featureEdges.push(edge);
  }
  const isClosed =
    edgeMap.edges.size > 0 &&
    borderLength <=
      Math.max(CLOSED_MAX_BORDER_M, CLOSED_BORDER_LENGTH_RATIO * totalLength);

  const rawIslands = exactFaces?.length
    ? islandsFromExactFaces(exactFaces)
    : islandsFromGroups(groups);

  if (!tris.length && exactFaces?.length) {
    // No triangles: box from the exact faces.
    const points = rawIslands.flatMap((island) =>
      island.polygons.flatMap((polygon) => [
        ...polygon.contour,
        ...polygon.holes.flat(),
      ])
    );
    if (points.length) {
      box.min = {
        x: Math.min(...points.map((p) => p.x)),
        y: Math.min(...points.map((p) => p.y)),
        z: Math.min(...points.map((p) => p.z)),
      };
      box.max = {
        x: Math.max(...points.map((p) => p.x)),
        y: Math.max(...points.map((p) => p.y)),
        z: Math.max(...points.map((p) => p.z)),
      };
    }
  }

  const isInside = isClosed ? createInsideSoupTester(triangles) : null;
  const islands = [];
  for (let island of rawIslands) {
    const area = faceArea(island);
    if (!(area > MIN_ISLAND_AREA_M2)) continue;
    if (isInside) {
      const inner = getIslandInteriorPoint(island);
      const side = inner ? probeNormalSide(inner, island.normal, isInside) : 1;
      const inward =
        side < 0 ||
        (side === 0 &&
          isInside({
            x: inner.x + island.normal.x * INSIDE_PROBE_M,
            y: inner.y + island.normal.y * INSIDE_PROBE_M,
            z: inner.z + island.normal.z * INSIDE_PROBE_M,
          }));
      if (inward) island = flipFace(island);
    } else if (!isCanonicalNormal(island.normal)) {
      island = flipFace(island);
    }
    islands.push({
      polygons: island.polygons,
      normal: island.normal,
      centroid: faceCentroid(island),
      area,
    });
  }

  const chains = attachChainSides(
    buildChains(featureEdges, positions),
    islands
  );

  const angleKey = (angleDeg) => Math.round((Number(angleDeg) || 0) * 1e3);
  let islandPairs = null;
  const surfacesByAngle = new Map();
  const getSurfaces = (angleDeg) => {
    const key = angleKey(angleDeg);
    if (!surfacesByAngle.has(key)) {
      if (!islandPairs) {
        islandPairs = buildIslandPairs(tris, edgeMap, positions, islands);
      }
      surfacesByAngle.set(
        key,
        buildSurfaces(islandPairs, islands.length, key / 1e3, isClosed)
      );
    }
    return surfacesByAngle.get(key);
  };
  const curvesByAngle = new Map();
  const getCurves = (angleDeg) => {
    const key = angleKey(angleDeg);
    if (!curvesByAngle.has(key)) {
      curvesByAngle.set(key, buildCurves(chains, key / 1e3));
    }
    return curvesByAngle.get(key);
  };

  return {
    islands,
    chains,
    isClosed,
    box,
    hash: hashTriangles(triangles),
    getSurfaces,
    getCurves,
  };
}
