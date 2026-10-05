import {
  localToNormalized,
  normalizedToLocal,
} from "../../annotationMesh3d/utils/mesh3dFrame.js";
import { dot, length, normalize } from "../../threedMesh/utils/vec3Utils.js";
import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";

import {
  getFaceNewellNormal,
  isCurvedFace,
  orientFaceLoops,
} from "./meshPaintGeometry.js";

// Conversions between the two forms of a painted part (db.meshPaints):
//
// STORED (row.geometry):
//   FACE { polygons: [{ contour: P[], holes: P[][] }], normal: [x, y, z] }
//   FACE, curved surface { vertices: P[], facets: [[contour, …holes], …],
//     angleDeg } — an indexed mesh of planar facets: every loop is an array
//     of indices into `vertices` (shared vertices stored once). No normal:
//     each contour is wound CCW seen from the painted side. angleDeg = the
//     smoothing angle the surface was grown with (the re-sync re-grows it
//     with the same one).
//   EDGE { points: P[], sides?: [[x, y, z], …], angleDeg? } — 2 points =
//     straight edge; more = a planar curve (closed: first point repeated),
//     with the angleDeg it was chained with.
//   P = [nx, ny, z]: x, y normalized to [0..1] against the base map reference
//   image (the db.points convention), z = base-map-local z in meters,
//   ABSOLUTE (the host's offsetZ is baked in — unlike mesh3d).
//   normal: base-map-local meters, toward the painted side. Only its SIGN is
//   authoritative: the direction is recomputed from the loops (Newell), so a
//   recalibration that tilts a slanted face stays exact.
//   sides (optional, local meters): normals of the host facets the edge
//   borders (buildHostPartIndex chain.sides) — its "material wedge", used by
//   the re-sync to follow the right edge when the host changes shape.
//
// LOCAL (geometry utils, 3D layer): V = {x, y, z} base-map-local meters, the
//   frame of imagesManager.getGroup(baseMapId) (see meshPaintGeometry.js).
//
// metrics: { imageWidth, imageHeight, meterByPx }.
//
// Pure (no three.js): node-testable, relative imports only.

const isFace = (partType) => partType === MESH_PAINT_PART_TYPES.FACE;

// Shared vertices of a curved surface are stored once (codebase-wide weld).
const VERTEX_WELD_M = 1e-4;

const withAngle = (target, source) =>
  Number.isFinite(source?.angleDeg)
    ? { ...target, angleDeg: source.angleDeg }
    : target;

const toArrayPoint = (p) => (Array.isArray(p) ? p : [p?.x, p?.y, p?.z]);
const toVector = (n) =>
  Array.isArray(n)
    ? { x: Number(n[0]) || 0, y: Number(n[1]) || 0, z: Number(n[2]) || 0 }
    : { x: Number(n?.x) || 0, y: Number(n?.y) || 0, z: Number(n?.z) || 0 };

export function paintPointToLocal(p, metrics) {
  return normalizedToLocal(toArrayPoint(p), metrics);
}

export function localToPaintPoint(v, metrics) {
  return localToNormalized(v, metrics);
}

/**
 * Stored geometry → LocalFace | LocalEdge (null when invalid).
 * FACE: normal = Newell normal of the loops, sign aligned with the stored
 * normal; loops wound about it (contours CCW, holes CW).
 */
export function paintGeometryToLocal(partType, geometry, metrics) {
  if (!geometry || !metrics) return null;
  const toLocal = (p) => paintPointToLocal(p, metrics);

  if (!isFace(partType)) {
    const points = (geometry.points || []).map(toLocal);
    if (points.length < 2) return null;
    const sides = (geometry.sides || [])
      .map((n) => normalize(toVector(n)))
      .filter((n) => length(n) > 0);
    const edge = sides.length ? { points, sides } : { points };
    return withAngle(edge, geometry);
  }

  if (Array.isArray(geometry.vertices) && Array.isArray(geometry.facets)) {
    const vertices = geometry.vertices.map(toLocal);
    const toLoop = (loop) => (loop || []).map((i) => vertices[i]);
    const isLoop = (loop) => loop.length >= 3 && loop.every(Boolean);
    const polygons = [];
    for (const facet of geometry.facets) {
      const [contour, ...holes] = (facet || []).map(toLoop);
      if (!contour || !isLoop(contour)) continue;
      polygons.push({ contour, holes: holes.filter(isLoop) });
    }
    const face = orientFaceLoops(
      withAngle({ polygons, curved: true }, geometry)
    );
    return face.polygons.length ? face : null;
  }

  const polygons = (geometry.polygons || [])
    .filter((polygon) => polygon?.contour?.length >= 3)
    .map((polygon) => ({
      contour: polygon.contour.map(toLocal),
      holes: (polygon.holes || [])
        .filter((hole) => hole?.length >= 3)
        .map((hole) => hole.map(toLocal)),
    }));
  if (!polygons.length) return null;

  const stored = normalize(toVector(geometry.normal));
  let normal = getFaceNewellNormal({ polygons });
  if (!normal) normal = length(stored) > 0 ? stored : null;
  if (!normal) return null;
  if (length(stored) > 0 && dot(normal, stored) < 0) {
    normal = { x: -normal.x, y: -normal.y, z: -normal.z };
  }
  return orientFaceLoops({ polygons, normal });
}

/**
 * LocalFace | LocalEdge → stored geometry. FACE: unit normal, contours CCW /
 * holes CW about it (enforced here).
 */
export function localGeometryToPaint(partType, localGeometry, metrics) {
  if (!localGeometry || !metrics) return null;
  const toPaint = (v) => localToPaintPoint(v, metrics);

  if (!isFace(partType)) {
    const points = (localGeometry.points || []).map(toPaint);
    const sides = (localGeometry.sides || [])
      .map((n) => normalize(n))
      .filter((n) => length(n) > 0)
      .map((n) => [n.x || 0, n.y || 0, n.z || 0]);
    const edge = sides.length ? { points, sides } : { points };
    return withAngle(edge, localGeometry);
  }

  const oriented = orientFaceLoops(localGeometry);
  if (isCurvedFace(oriented)) {
    const vertices = [];
    const indexByKey = new Map();
    const toIndex = (v) => {
      const key = `${Math.round(v.x / VERTEX_WELD_M)},${Math.round(
        v.y / VERTEX_WELD_M
      )},${Math.round(v.z / VERTEX_WELD_M)}`;
      let index = indexByKey.get(key);
      if (index === undefined) {
        index = vertices.length;
        indexByKey.set(key, index);
        vertices.push(toPaint(v));
      }
      return index;
    };
    const facets = oriented.polygons.map((polygon) => [
      polygon.contour.map(toIndex),
      ...polygon.holes.map((hole) => hole.map(toIndex)),
    ]);
    return withAngle({ vertices, facets }, localGeometry);
  }
  // `|| 0`: no -0 in stored normals.
  const { x, y, z } = oriented.normal;
  return {
    polygons: oriented.polygons.map((polygon) => ({
      contour: polygon.contour.map(toPaint),
      holes: polygon.holes.map((hole) => hole.map(toPaint)),
    })),
    normal: [x || 0, y || 0, z || 0],
  };
}
