import pointInPolygon2d from "../../threedMesh/utils/pointInPolygon2d.js";
import { signedArea2d } from "../../threedMesh/utils/computeFaceArea.js";
import {
  liftPointTo3d,
  projectPointTo2d,
} from "../../threedMesh/utils/planeProjection.js";

import locatePathOnMesh3d from "./locatePathOnMesh3d.js";
import { classifyPointOnFace, getFace2d } from "./mesh3dFace2d.js";
import { buildEdgeMap, cloneMesh3d, getFaceLoops } from "./mesh3dTopology.js";

// Splits the face(s) of a mesh along a path drawn on it (the SketchUp "line
// on a face"): the mesh stays one mesh, it only gains vertices and faces.
//
// - a run of the path going from the face boundary to the face boundary
//   cuts the face in two;
// - a closed path strictly inside the face becomes a new face, and a hole of
//   the original one.
//
// Boundary points that fall on an edge are inserted as vertices in the face
// AND in the neighbor sharing that edge, so shared edges keep matching.
//
// points: [{x, y, z}] local meters (on one face plane). closed: the path
// loops back to its first point. Returns the new mesh, or null when the
// path splits nothing (off the mesh, dangling, along an edge...).
export default function splitMesh3dFace(mesh, points, { closed = false } = {}) {
  if (!mesh?.faces?.length || !points || points.length < 2) return null;

  const faceIndex = locatePathOnMesh3d(mesh, points, { closed });
  if (faceIndex < 0) return null;

  const face = mesh.faces[faceIndex];
  const face2d = getFace2d(mesh.vertices, face);
  const kinds = points.map(
    (p) =>
      classifyPointOnFace(face2d, face, projectPointTo2d(p, face2d.basis)).kind
  );
  const isBoundary = (kind) => kind === "VERTEX" || kind === "EDGE";

  if (closed && !kinds.some(isBoundary)) {
    return points.length >= 3
      ? splitByInnerLoop(mesh, faceIndex, points)
      : null;
  }

  // Runs: boundary point -> interior points -> boundary point. The cyclic
  // walk of a closed path starts on a boundary point.
  const n = points.length;
  const start = closed ? kinds.findIndex(isBoundary) : 0;
  const count = closed ? n + 1 : n;
  const runs = [];
  let run = null;
  for (let k = 0; k < count; k++) {
    const index = (start + k) % n;
    const boundary = isBoundary(kinds[index]);
    if (!run) {
      if (boundary) run = [points[index]];
      continue;
    }
    run.push(points[index]);
    if (boundary) {
      runs.push(run);
      run = [points[index]];
    }
  }

  let next = mesh;
  let splitCount = 0;
  for (const runPoints of runs) {
    // Re-locate on the current mesh: earlier runs replaced the face. A run
    // along the boundary (two boundary points, midpoint on an edge) is
    // carried by no face and skipped here.
    const runFaceIndex = locatePathOnMesh3d(next, runPoints);
    if (runFaceIndex < 0) continue;
    const result = splitByOpenPath(next, runFaceIndex, runPoints);
    if (result) {
      next = result;
      splitCount++;
    }
  }
  return splitCount > 0 ? next : null;
}

// Vertex index of a boundary point of the face: an existing vertex, or a new
// one inserted on the edge (in the face and in its neighbor). Mutates mesh.
function resolveBoundaryVertex(mesh, faceIndex, point) {
  const face = mesh.faces[faceIndex];
  const face2d = getFace2d(mesh.vertices, face);
  const p2d = projectPointTo2d(point, face2d.basis);
  const where = classifyPointOnFace(face2d, face, p2d);
  if (where.kind === "VERTEX") {
    return { vertexIndex: where.vertexIndex, loopIndex: where.loopIndex };
  }
  if (where.kind !== "EDGE") return null;

  const loop = getFaceLoops(face)[where.loopIndex];
  const a = loop[where.index];
  const b = loop[(where.index + 1) % loop.length];
  const partner = buildEdgeMap(mesh).get(`${b}_${a}`);

  // Exactly on the edge (projected), so neighbors stay planar.
  const a2d = face2d.loops[where.loopIndex][where.index];
  const b2d = face2d.loops[where.loopIndex][(where.index + 1) % loop.length];
  const onEdge = liftPointTo3d(
    {
      x: a2d.x + where.t * (b2d.x - a2d.x),
      y: a2d.y + where.t * (b2d.y - a2d.y),
    },
    face2d.basis
  );
  const vertexIndex = mesh.vertices.length;
  mesh.vertices.push(onEdge);
  loop.splice(where.index + 1, 0, vertexIndex);

  if (partner && partner.faceIndex !== faceIndex) {
    const partnerLoop = getFaceLoops(mesh.faces[partner.faceIndex])[
      partner.loopIndex
    ];
    const at = partnerLoop.findIndex(
      (vi, i) => vi === b && partnerLoop[(i + 1) % partnerLoop.length] === a
    );
    if (at >= 0) partnerLoop.splice(at + 1, 0, vertexIndex);
  }
  return { vertexIndex, loopIndex: where.loopIndex };
}

// Forward arc of a loop from index `from` to index `to`, both included.
function getArc(loop, from, to) {
  const arc = [];
  let i = from;
  for (;;) {
    arc.push(loop[i]);
    if (i === to) break;
    i = (i + 1) % loop.length;
  }
  return arc;
}

function splitByOpenPath(sourceMesh, faceIndex, points) {
  const mesh = cloneMesh3d(sourceMesh);
  const startRef = resolveBoundaryVertex(mesh, faceIndex, points[0]);
  const endRef = resolveBoundaryVertex(
    mesh,
    faceIndex,
    points[points.length - 1]
  );
  if (!startRef || !endRef) return null;
  if (startRef.loopIndex !== endRef.loopIndex) return null; // contour ↔ hole
  if (startRef.vertexIndex === endRef.vertexIndex) return null;

  const face = mesh.faces[faceIndex];
  const loopIndex = startRef.loopIndex;
  const loop = getFaceLoops(face)[loopIndex];
  const ip = loop.indexOf(startRef.vertexIndex);
  const iq = loop.indexOf(endRef.vertexIndex);
  if (ip < 0 || iq < 0) return null;

  const inner = [];
  for (let i = 1; i < points.length - 1; i++) {
    inner.push(mesh.vertices.length);
    mesh.vertices.push({ x: points[i].x, y: points[i].y, z: points[i].z });
  }

  // loopA: boundary p → q, back along the path. loopB: boundary q → p, then
  // the path p → q. Both keep the winding of the split loop.
  const loopA = [...getArc(loop, ip, iq), ...[...inner].reverse()];
  const loopB = [...getArc(loop, iq, ip), ...inner];
  if (loopA.length < 3 || loopB.length < 3) return null;

  const face2d = getFace2d(mesh.vertices, face);
  const to2d = (indices) =>
    indices.map((vi) => projectPointTo2d(mesh.vertices[vi], face2d.basis));
  const areaA = signedArea2d(to2d(loopA));
  const areaB = signedArea2d(to2d(loopB));
  if (Math.abs(areaA) < 1e-10 || Math.abs(areaB) < 1e-10) return null;

  if (loopIndex === 0) {
    // Contour cut in two faces; each hole goes to the face containing it.
    const contourA = to2d(loopA);
    const holesA = [];
    const holesB = [];
    for (const hole of face.holes) {
      const probe = projectPointTo2d(mesh.vertices[hole[0]], face2d.basis);
      (pointInPolygon2d(probe, contourA) ? holesA : holesB).push(hole);
    }
    mesh.faces[faceIndex] = { loop: loopA, holes: holesA };
    mesh.faces.push({ loop: loopB, holes: holesB });
    return mesh;
  }

  // Path between two points of the same hole: the counter-clockwise side is
  // a new face filling part of the face, the clockwise side is the hole
  // that remains.
  if (areaA > 0 === areaB > 0) return null;
  const newLoop = areaA > 0 ? loopA : loopB;
  const newHole = areaA > 0 ? loopB : loopA;
  face.holes[loopIndex - 1] = newHole;
  mesh.faces.push({ loop: newLoop, holes: [] });
  return mesh;
}

function splitByInnerLoop(sourceMesh, faceIndex, points) {
  const mesh = cloneMesh3d(sourceMesh);
  const face = mesh.faces[faceIndex];
  const face2d = getFace2d(mesh.vertices, face);

  let loop = points.map((p) => {
    mesh.vertices.push({ x: p.x, y: p.y, z: p.z });
    return mesh.vertices.length - 1;
  });
  const loop2d = () =>
    loop.map((vi) => projectPointTo2d(mesh.vertices[vi], face2d.basis));
  const area = signedArea2d(loop2d());
  if (Math.abs(area) < 1e-10) return null;
  if (area < 0) loop = loop.reverse();
  const contour = loop2d();

  // Holes of the face that the new loop encloses move to the new face.
  const kept = [];
  const moved = [];
  for (const hole of face.holes) {
    const probe = projectPointTo2d(mesh.vertices[hole[0]], face2d.basis);
    (pointInPolygon2d(probe, contour) ? moved : kept).push(hole);
  }
  face.holes = [...kept, [...loop].reverse()];
  mesh.faces.push({ loop, holes: moved });
  return mesh;
}
