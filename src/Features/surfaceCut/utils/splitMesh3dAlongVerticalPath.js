import isMesh3dClosed from "../../annotationMesh3d/utils/isMesh3dClosed.js";
import { ON_BOUNDARY_TOL_M } from "../../annotationMesh3d/utils/mesh3dConstants.js";
import { getFace2d } from "../../annotationMesh3d/utils/mesh3dFace2d.js";
import {
  cleanupMesh3d,
  cloneMesh3d,
  getFaceLoops,
  getFaceNormal,
} from "../../annotationMesh3d/utils/mesh3dTopology.js";
import projectMesh3dToRings from "../../annotationMesh3d/utils/projectMesh3dToRings.js";
import { splitMesh3dFaceDetailed } from "../../annotationMesh3d/utils/splitMesh3dFace.js";
import {
  liftPointTo3d,
  projectPointTo2d,
} from "../../threedMesh/utils/planeProjection.js";

import getPathChunksInRegion, {
  extendPathEnds,
  intersectSegments,
  isPathSelfIntersecting,
  signedArea2d,
} from "./getPathChunksInRegion.js";
import splitFlatRegionAlongChunks from "./splitFlatRegionAlongChunks.js";

// |n.z| at or below this: a vertical face (its plan trace is a segment).
const VERTICAL_NZ = 1e-6;

// A vertex closer than this (plan, m) to the curtain lies on it.
const ON_CURTAIN_M = 1e-4;

// The curtain ends are pushed this far (m) beyond the plan silhouette, so
// every face sees them outside.
const OVERSHOOT_M = 0.01;

// Weld grid (m) of the vertices the caps add at the curtain joints.
const JOINT_WELD_M = 1e-6;

// Vertical guillotine of an annotation mesh: the vertical "curtain" standing
// on a plan polyline cuts every face it meets, and the mesh falls apart into
// the pieces on each side. A closed mesh gives closed pieces: each piece gets
// the section on the curtain as new faces ("caps").
//
// mesh: LOCAL mesh { vertices: [{x, y, z}], faces: [{ loop, holes }] } (x, y
// plan, z up, meters). path: plan polyline [{x, y}] in the same frame; an end
// stopping inside the plan silhouette is prolonged to its edge.
//
// Returns { pieces, capped } — pieces: LOCAL meshes, the largest plan area
// first; capped: the input was closed and every piece got its caps — or
// { error }:
//   SELF_INTERSECTING  the path crosses itself
//   NO_CROSSING        the path does not cross the silhouette
//   NOT_THROUGH        the mesh does not fall apart (path along a face...)
export default function splitMesh3dAlongVerticalPath(
  mesh,
  path,
  { tolerance = ON_BOUNDARY_TOL_M } = {}
) {
  if (!mesh?.faces?.length || !path || path.length < 2) {
    return { error: "NO_CROSSING" };
  }
  const footprint = projectMesh3dToRings(mesh);
  if (!footprint) return { error: "NO_CROSSING" };
  const footprintLoops = [footprint.contour, ...footprint.holes];

  const extended = extendPathEnds(footprintLoops, path, { tolerance });
  if (extended.length < 2) return { error: "NO_CROSSING" };
  if (isPathSelfIntersecting(extended)) return { error: "SELF_INTERSECTING" };
  const crossing = getPathChunksInRegion(footprintLoops, extended, {
    tolerance,
  });
  if (!crossing.chunks?.length) return { error: "NO_CROSSING" };
  const curtain = buildCurtain(overshootEnds(extended, OVERSHOOT_M));

  // 1. Draw the trace of the curtain on every face. The traces are computed
  // on the original faces; a face split by an earlier trace keeps its index,
  // its pieces are appended (its "family").
  const runsByFace = mesh.faces.map((_, faceIndex) =>
    getFaceRuns(mesh, faceIndex, curtain, tolerance)
  );
  let current = cloneMesh3d(mesh);
  runsByFace.forEach((runs, faceIndex) => {
    const family = [faceIndex];
    for (const run of runs) {
      const before = current.faces.length;
      const split = splitMesh3dFaceDetailed(current, run, {
        faceIndices: family,
      });
      if (!split) continue;
      current = split.mesh;
      for (let i = before; i < current.faces.length; i++) family.push(i);
    }
  });

  // 2. Fall apart: faces stay together across every edge that is not on the
  // curtain.
  const { vertices, faces } = current;
  const onCurtain = (p) => locateOnCurtain(curtain, p).distance <= ON_CURTAIN_M;
  const vertexOnCurtain = vertices.map(onCurtain);
  const isCutEdge = (a, b) =>
    vertexOnCurtain[a] &&
    vertexOnCurtain[b] &&
    onCurtain({
      x: (vertices[a].x + vertices[b].x) / 2,
      y: (vertices[a].y + vertices[b].y) / 2,
    });
  const faceEdges = faces.map((face) =>
    getFaceLoops(face).flatMap((loop) =>
      loop.map((a, i) => [a, loop[(i + 1) % loop.length]])
    )
  );
  // A face lying on the curtain (a wall face along the cut) belongs to no
  // side: it follows one of its neighbors.
  const isCurtainFace = faceEdges.map((edges) =>
    edges.every(([a, b]) => isCutEdge(a, b))
  );

  const owner = new Map();
  faceEdges.forEach((edges, faceIndex) => {
    for (const [a, b] of edges) owner.set(`${a}_${b}`, faceIndex);
  });
  const parent = faces.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  faceEdges.forEach((edges, faceIndex) => {
    if (isCurtainFace[faceIndex]) return;
    for (const [a, b] of edges) {
      const other = owner.get(`${b}_${a}`);
      if (other === undefined || isCurtainFace[other]) continue;
      if (isCutEdge(a, b)) continue;
      parent[find(faceIndex)] = find(other);
    }
  });

  const componentsByRoot = new Map();
  faces.forEach((_, faceIndex) => {
    if (isCurtainFace[faceIndex]) return;
    const root = find(faceIndex);
    if (!componentsByRoot.has(root)) componentsByRoot.set(root, []);
    componentsByRoot.get(root).push(faceIndex);
  });
  const components = [...componentsByRoot.values()];
  if (components.length < 2) return { error: "NOT_THROUGH" };
  faces.forEach((_, faceIndex) => {
    if (!isCurtainFace[faceIndex]) return;
    const neighbor = faceEdges[faceIndex]
      .map(([a, b]) => owner.get(`${b}_${a}`))
      .find((other) => other !== undefined && !isCurtainFace[other]);
    const root = neighbor !== undefined ? find(neighbor) : null;
    const target =
      (root !== null && componentsByRoot.get(root)) ||
      components.reduce((a, b) => (b.length > a.length ? b : a));
    target.push(faceIndex);
  });

  // 3. Caps: the section of each closed piece on the curtain.
  const closed = isMesh3dClosed(mesh);
  const jointVertexByKey = new Map();
  let capped = closed;
  const pieces = components.map((component) => {
    const pieceFaces = component.map((faceIndex) => faces[faceIndex]);
    if (closed) {
      const caps = buildCaps(current, component, {
        curtain,
        isCutEdge,
        jointVertexByKey,
        tolerance,
      });
      if (caps) pieceFaces.push(...caps);
      else capped = false;
    }
    return cleanupMesh3d({ vertices: current.vertices, faces: pieceFaces });
  });

  const withArea = pieces.map((piece) => ({ piece, area: getPlanArea(piece) }));
  withArea.sort((a, b) => b.area - a.area);
  return { pieces: withArea.map(({ piece }) => piece), capped };
}

// --- curtain

function buildCurtain(points) {
  const panels = [];
  let s = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    panels.push({ a, b, len, s0: s });
    s += len;
  }
  return { points, panels, length: s };
}

// Plan distance to the curtain and abscissa (s) of the nearest point on it.
function locateOnCurtain(curtain, p) {
  let best = { distance: Infinity, s: 0 };
  for (const panel of curtain.panels) {
    const { a, b, len, s0 } = panel;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len);
    t = Math.max(0, Math.min(1, t));
    const distance = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (distance < best.distance) best = { distance, s: s0 + t * len };
  }
  return best;
}

function pointAtAbscissa(curtain, s) {
  for (const panel of curtain.panels) {
    if (s <= panel.s0 + panel.len || panel === curtain.panels.at(-1)) {
      const t = Math.max(0, Math.min(1, (s - panel.s0) / panel.len));
      return {
        x: panel.a.x + t * (panel.b.x - panel.a.x),
        y: panel.a.y + t * (panel.b.y - panel.a.y),
      };
    }
  }
  return { ...curtain.points[0] };
}

function overshootEnds(points, distance) {
  const out = points.map((p) => ({ ...p }));
  const push = (end, from) => {
    const len = Math.hypot(end.x - from.x, end.y - from.y);
    if (len === 0) return;
    end.x += ((end.x - from.x) / len) * distance;
    end.y += ((end.y - from.y) / len) * distance;
  };
  push(out[0], points[1]);
  push(out[out.length - 1], points[points.length - 2]);
  return out;
}

// --- traces

// Paths of the curtain on a face, boundary to boundary, in 3D (on its plane).
function getFaceRuns(mesh, faceIndex, curtain, tolerance) {
  const face = mesh.faces[faceIndex];
  const n = getFaceNormal(mesh.vertices, face);
  const face2d = getFace2d(mesh.vertices, face);
  const toRuns = (path3d) => {
    const path2d = path3d.map((p) => projectPointTo2d(p, face2d.basis));
    const { chunks } = getPathChunksInRegion(face2d.loops, path2d, {
      tolerance,
    });
    return (chunks ?? []).map((chunk) =>
      chunk.map((p) => liftPointTo3d(p, face2d.basis))
    );
  };

  const o = mesh.vertices[face.loop[0]];
  // A slanted face meets the curtain along the curtain polyline lifted onto
  // its plane.
  if (Math.abs(n.z) > VERTICAL_NZ) {
    return toRuns(
      curtain.points.map((p) => ({
        x: p.x,
        y: p.y,
        z: o.z - (n.x * (p.x - o.x) + n.y * (p.y - o.y)) / n.z,
      }))
    );
  }

  // A vertical face meets it along vertical lines, where its plan trace
  // crosses the curtain.
  const hLen = Math.hypot(n.x, n.y);
  if (hLen === 0) return [];
  const h = { x: -n.y / hLen, y: n.x / hLen };
  let uMin = Infinity;
  let uMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const vi of face.loop) {
    const v = mesh.vertices[vi];
    const u = (v.x - o.x) * h.x + (v.y - o.y) * h.y;
    uMin = Math.min(uMin, u);
    uMax = Math.max(uMax, u);
    zMin = Math.min(zMin, v.z);
    zMax = Math.max(zMax, v.z);
  }
  const traceA = { x: o.x + uMin * h.x, y: o.y + uMin * h.y };
  const traceB = { x: o.x + uMax * h.x, y: o.y + uMax * h.y };

  const runs = [];
  const seen = [];
  for (const panel of curtain.panels) {
    const dx = (panel.b.x - panel.a.x) / panel.len;
    const dy = (panel.b.y - panel.a.y) / panel.len;
    // A panel along the face: the face lies on the curtain (or beside it).
    if (Math.abs(dx * h.y - dy * h.x) < 1e-9) continue;
    const hit = intersectSegments(panel.a, panel.b, traceA, traceB);
    if (!hit) continue;
    if (seen.some((p) => Math.hypot(p.x - hit.x, p.y - hit.y) <= tolerance)) {
      continue;
    }
    seen.push(hit);
    runs.push(
      ...toRuns([
        { x: hit.x, y: hit.y, z: zMin - 1 },
        { x: hit.x, y: hit.y, z: zMax + 1 },
      ])
    );
  }
  return runs;
}

// --- caps

// Faces closing a piece along the curtain: its open boundary (cut edges
// only, walked backwards so the caps face outward), unfolded on the curtain
// as (s, z), nested into regions and split at the curtain joints so each cap
// face stays planar. null when the boundary does not close into loops.
function buildCaps(
  mesh,
  component,
  { curtain, isCutEdge, jointVertexByKey, tolerance }
) {
  const directed = new Set();
  for (const faceIndex of component) {
    for (const loop of getFaceLoops(mesh.faces[faceIndex])) {
      for (let i = 0; i < loop.length; i++) {
        directed.add(`${loop[i]}_${loop[(i + 1) % loop.length]}`);
      }
    }
  }
  const nextByVertex = new Map();
  let edgeCount = 0;
  for (const key of directed) {
    const [a, b] = key.split("_").map(Number);
    if (directed.has(`${b}_${a}`)) continue;
    if (!isCutEdge(a, b)) return null;
    if (!nextByVertex.has(b)) nextByVertex.set(b, []);
    nextByVertex.get(b).push(a);
    edgeCount += 1;
  }
  if (!edgeCount) return [];

  // Chain the reversed boundary edges into loops.
  const loops = [];
  for (const [start, nexts] of nextByVertex) {
    while (nexts.length) {
      const loop = [start];
      let at = nexts.pop();
      let guard = edgeCount + 1;
      while (at !== start) {
        if (guard-- <= 0) return null;
        const options = nextByVertex.get(at);
        if (!options?.length) return null;
        loop.push(at);
        at = options.pop();
      }
      if (loop.length < 3) return null;
      loops.push(loop);
    }
  }

  // Unfold on the curtain and nest: even depth = contour, odd = hole.
  const unfolded = loops.map((loop) =>
    loop.map((vi) => {
      const v = mesh.vertices[vi];
      return { x: locateOnCurtain(curtain, v).s, y: v.z };
    })
  );
  const order = loops
    .map((_, i) => i)
    .sort(
      (i, j) =>
        Math.abs(signedArea2d(unfolded[j])) -
        Math.abs(signedArea2d(unfolded[i]))
    );
  const parentOf = new Map();
  const depthOf = new Map();
  order.forEach((i, rank) => {
    const probe = {
      x: (unfolded[i][0].x + unfolded[i][1].x) / 2,
      y: (unfolded[i][0].y + unfolded[i][1].y) / 2,
    };
    let parent = null;
    for (let k = rank - 1; k >= 0; k--) {
      const j = order[k];
      if (pointInLoop(probe, unfolded[j])) {
        parent = j;
        break;
      }
    }
    parentOf.set(i, parent);
    depthOf.set(i, parent === null ? 0 : depthOf.get(parent) + 1);
  });

  const joints = curtain.panels.slice(1).map((panel) => panel.s0);
  const caps = [];
  for (const i of order) {
    if (depthOf.get(i) % 2 !== 0) continue;
    const holes = order.filter(
      (j) => parentOf.get(j) === i && depthOf.get(j) % 2 === 1
    );
    const regionLoops = [loops[i], ...holes.map((j) => loops[j])];
    const regionLoops2d = [unfolded[i], ...holes.map((j) => unfolded[j])];

    const sValues = unfolded[i].map((p) => p.x);
    const zValues = unfolded[i].map((p) => p.y);
    const sMin = Math.min(...sValues);
    const sMax = Math.max(...sValues);
    const zMin = Math.min(...zValues) - 1;
    const zMax = Math.max(...zValues) + 1;
    const chunks = joints
      .filter((s) => s > sMin + tolerance && s < sMax - tolerance)
      .flatMap(
        (s) =>
          getPathChunksInRegion(
            regionLoops2d,
            [
              { x: s, y: zMin },
              { x: s, y: zMax },
            ],
            { tolerance }
          ).chunks ?? []
      );
    if (!chunks.length) {
      caps.push({ loop: regionLoops[0], holes: regionLoops.slice(1) });
      continue;
    }

    const split = splitFlatRegionAlongChunks(regionLoops2d, chunks);
    if (!split) return null;
    const flatToMesh = regionLoops.flat();
    const toMeshIndex = (flatIndex) => {
      if (flatIndex < flatToMesh.length) return flatToMesh[flatIndex];
      const { x: s, y: z } = split.vertices[flatIndex];
      const key = `${Math.round(s / JOINT_WELD_M)}_${Math.round(z / JOINT_WELD_M)}`;
      if (!jointVertexByKey.has(key)) {
        const plan = pointAtAbscissa(curtain, s);
        mesh.vertices.push({ x: plan.x, y: plan.y, z });
        jointVertexByKey.set(key, mesh.vertices.length - 1);
      }
      return jointVertexByKey.get(key);
    };
    for (const face of split.faces) {
      caps.push({
        loop: face.loop.map(toMeshIndex),
        holes: (face.holes ?? []).map((hole) => hole.map(toMeshIndex)),
      });
    }
  }
  return caps;
}

function pointInLoop(p, loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i];
    const b = loop[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function getPlanArea(mesh) {
  const rings = projectMesh3dToRings(mesh);
  if (!rings) return 0;
  return (
    Math.abs(signedArea2d(rings.contour)) -
    rings.holes.reduce((sum, hole) => sum + Math.abs(signedArea2d(hole)), 0)
  );
}
