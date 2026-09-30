import {
  cross,
  dot,
  length,
  normalize,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

import { COLLINEAR_SIN } from "./mesh3dConstants.js";

// Topology helpers of the annotation mesh, in its LOCAL working form:
//
//   { vertices: [{x, y, z}], faces: [{ loop: [i, …], holes: [[i, …], …] }] }
//
// Faces are planar polygons indexing shared vertices; a loop is open (no
// closing duplicate), counter-clockwise around the outward normal (holes run
// clockwise). Meters, base-map-local frame — see mesh3dFrame.js for the
// stored (normalized) form.
//
// Pure (no three.js): replayable from node scripts.

export const getFaceLoops = (face) => [face.loop, ...(face.holes || [])];

export const cloneFace = (face) => ({
  loop: [...face.loop],
  holes: (face.holes || []).map((hole) => [...hole]),
});

export const cloneMesh3d = (mesh) => ({
  vertices: mesh.vertices.map((v) => ({ x: v.x, y: v.y, z: v.z })),
  faces: mesh.faces.map(cloneFace),
});

export const reverseFace = (face) => ({
  loop: [...face.loop].reverse(),
  holes: (face.holes || []).map((hole) => [...hole].reverse()),
});

// Newell area vector of a loop: direction = normal of a CCW loop, length =
// twice its area. Robust to collinear runs and concave loops.
export function getLoopAreaVector(vertices, loop) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = vertices[loop[i]];
    const q = vertices[loop[(i + 1) % loop.length]];
    x += (p.y - q.y) * (p.z + q.z);
    y += (p.z - q.z) * (p.x + q.x);
    z += (p.x - q.x) * (p.y + q.y);
  }
  return { x, y, z };
}

export function getFaceNormal(vertices, face) {
  return normalize(getLoopAreaVector(vertices, face.loop));
}

// Net area (m²) of a face: holes run clockwise, so their area vectors
// subtract from the contour's.
export function getFaceArea(vertices, face) {
  let sum = { x: 0, y: 0, z: 0 };
  for (const loop of getFaceLoops(face)) {
    const v = getLoopAreaVector(vertices, loop);
    sum = { x: sum.x + v.x, y: sum.y + v.y, z: sum.z + v.z };
  }
  return length(sum) / 2;
}

// Directed edge "a_b" -> { faceIndex, loopIndex, index } (index of `a` in the
// loop). In a closed mesh every directed edge has exactly one reverse
// partner, carried by the neighbor face.
export function buildEdgeMap(mesh) {
  const map = new Map();
  mesh.faces.forEach((face, faceIndex) => {
    getFaceLoops(face).forEach((loop, loopIndex) => {
      for (let index = 0; index < loop.length; index++) {
        const key = `${loop[index]}_${loop[(index + 1) % loop.length]}`;
        if (!map.has(key)) map.set(key, { faceIndex, loopIndex, index });
      }
    });
  });
  return map;
}

function isCollinear(prev, p, next) {
  const e1 = sub(p, prev);
  const e2 = sub(next, p);
  const l1 = length(e1);
  const l2 = length(e2);
  if (l1 === 0 || l2 === 0) return true;
  return length(cross(e1, e2)) / (l1 * l2) < COLLINEAR_SIN;
}

// Drops consecutive duplicates and zero-width spurs (x, y, x) of a loop.
function collapseLoop(loop) {
  const out = [...loop];
  let changed = true;
  while (changed && out.length > 0) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const n = out.length;
      if (n < 2) break;
      const next = (i + 1) % n;
      if (out[i] === out[next]) {
        out.splice(next, 1);
        changed = true;
        break;
      }
      if (n >= 3 && out[i] === out[(i + 2) % n]) {
        // x, y, x: remove y and one x.
        const removed = [next, (i + 2) % n].sort((a, b) => b - a);
        for (const index of removed) out.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
}

// Normalizes a mesh after an edit:
// - collapses duplicate / spur vertices in every loop;
// - removes the vertices that are collinear in EVERY loop using them (a
//   vertex kept as a corner by one face must stay on the edges of its
//   neighbors, or the shared edges would stop matching);
// - drops degenerate faces / holes and unused vertices (re-indexing).
export function cleanupMesh3d(mesh) {
  const vertices = mesh.vertices;
  let faces = mesh.faces.map(cloneFace);

  let changed = true;
  while (changed) {
    changed = false;

    faces = faces
      .map((face) => ({
        loop: collapseLoop(face.loop),
        holes: face.holes.map(collapseLoop).filter((hole) => hole.length >= 3),
      }))
      .filter((face) => face.loop.length >= 3);

    // vertex -> is it collinear in all of its loop occurrences?
    const removable = new Map();
    for (const face of faces) {
      for (const loop of getFaceLoops(face)) {
        const n = loop.length;
        for (let i = 0; i < n; i++) {
          const vi = loop[i];
          if (removable.get(vi) === false) continue;
          removable.set(
            vi,
            isCollinear(
              vertices[loop[(i - 1 + n) % n]],
              vertices[vi],
              vertices[loop[(i + 1) % n]]
            )
          );
        }
      }
    }
    const toRemove = new Set();
    for (const [vi, ok] of removable) if (ok) toRemove.add(vi);
    if (toRemove.size) {
      changed = true;
      const strip = (loop) => loop.filter((vi) => !toRemove.has(vi));
      faces = faces.map((face) => ({
        loop: strip(face.loop),
        holes: face.holes.map(strip),
      }));
    }
  }

  return compactMesh3d({ vertices, faces });
}

// Drops unused vertices and re-indexes the loops.
export function compactMesh3d(mesh) {
  const remap = new Map();
  const vertices = [];
  const mapIndex = (vi) => {
    let next = remap.get(vi);
    if (next === undefined) {
      next = vertices.length;
      remap.set(vi, next);
      const v = mesh.vertices[vi];
      vertices.push({ x: v.x, y: v.y, z: v.z });
    }
    return next;
  };
  const faces = mesh.faces.map((face) => ({
    loop: face.loop.map(mapIndex),
    holes: (face.holes || []).map((hole) => hole.map(mapIndex)),
  }));
  return { vertices, faces };
}

// Signed distance of p to the plane of a face (positive on the normal side).
export function getDistanceToFacePlane(vertices, face, p, normal) {
  const n = normal ?? getFaceNormal(vertices, face);
  return dot(sub(p, vertices[face.loop[0]]), n);
}
