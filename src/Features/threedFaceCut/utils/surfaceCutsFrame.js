import {
  localToNormalized,
  normalizedToLocal,
} from "../../annotationMesh3d/utils/mesh3dFrame.js";
import { dot, length, normalize } from "../../threedMesh/utils/vec3Utils.js";

// Conversions of a stored surface cut (annotation.surfaceCuts) to the local
// form the geometry utils work on.
//
// STORED: { id, axis: "H" | "V", point: [nx, ny, zAbs], normal: [x, y, z],
//   seed: [nx, ny, zAbs] }
//   point: a point of the cut plane; seed: the point the user clicked (the
//   cut only concerns the chain of facets holding it, see
//   cutShellByPlaneNear). Both follow the db.meshPaints convention: x, y
//   normalized to [0..1] against the base map reference image, z in
//   base-map-local meters, ABSOLUTE. normal: base-map-local meters, unit.
//   A REMOVAL (a piece deleted by the user) is an entry { id, kind:
//   "REMOVE", point: [nx, ny, zAbs], surface } of the same list: `point` is
//   a point ON the removed piece (the centroid of one of its triangles),
//   `surface` its area (m²) when removed, for the quantities.
//
// LOCAL: { plane: { normal: {x, y, z}, constant }, seed: {x, y, z} } in
//   base-map-local meters (dot(normal, p) === constant on the plane), or
//   { kind: "REMOVE", point: {x, y, z} }.
//
// metrics: { imageWidth, imageHeight, meterByPx }.
//
// Pure (no three.js): node-testable, relative imports only.

const toVector = (n) =>
  Array.isArray(n)
    ? { x: Number(n[0]) || 0, y: Number(n[1]) || 0, z: Number(n[2]) || 0 }
    : { x: Number(n?.x) || 0, y: Number(n?.y) || 0, z: Number(n?.z) || 0 };

const isPoint3 = (p) =>
  Array.isArray(p) && p.length >= 2 && p.slice(0, 3).every(Number.isFinite);

export const SURFACE_CUT_REMOVE = "REMOVE";

export const isSurfaceCutRemoval = (cut) => cut?.kind === SURFACE_CUT_REMOVE;

// Area (m²) of the pieces removed from the host, as recorded at removal
// time (the quantities subtract it).
export function getSurfaceCutsRemovedM2(cuts) {
  let total = 0;
  for (const cut of cuts || []) {
    if (isSurfaceCutRemoval(cut) && Number.isFinite(cut.surface)) {
      total += Math.max(0, cut.surface);
    }
  }
  return total;
}

export function surfaceCutToLocal(cut, metrics) {
  if (!cut || !metrics) return null;
  if (isSurfaceCutRemoval(cut)) {
    if (!isPoint3(cut.point)) return null;
    return {
      id: cut.id ?? null,
      kind: SURFACE_CUT_REMOVE,
      point: normalizedToLocal(cut.point, metrics),
    };
  }
  if (!isPoint3(cut.point) || !isPoint3(cut.seed)) return null;
  const normal = normalize(toVector(cut.normal));
  if (!(length(normal) > 0.5)) return null;
  const point = normalizedToLocal(cut.point, metrics);
  const seed = normalizedToLocal(cut.seed, metrics);
  return {
    id: cut.id ?? null,
    axis: cut.axis ?? null,
    plane: { normal, constant: dot(normal, point) },
    seed,
  };
}

/**
 * Local cut → stored form. The stored point is the seed projected onto the
 * plane (any point of the plane does).
 */
export function localToSurfaceCut({ id, axis, plane, seed }, metrics) {
  if (!plane?.normal || !seed || !metrics) return null;
  const normal = normalize(plane.normal);
  const off = dot(normal, seed) - plane.constant;
  const point = {
    x: seed.x - normal.x * off,
    y: seed.y - normal.y * off,
    z: seed.z - normal.z * off,
  };
  return {
    id,
    axis,
    point: localToNormalized(point, metrics),
    normal: [normal.x, normal.y, normal.z],
    seed: localToNormalized(seed, metrics),
  };
}

const roundKey = (v) => Math.round((Number(v) || 0) * 1e5) / 1e5;

// Stable signature of a cut list (what applySurfaceCuts keys its "already
// applied" check on).
export function getSurfaceCutsKey(cuts) {
  return (cuts || [])
    .map(
      (c) =>
        `${c?.id ?? ""}:${c?.kind ?? ""}:${c?.axis ?? ""}:${(
          c?.point || []
        ).map(
          roundKey
        )}:${(c?.normal || []).map(roundKey)}:${(c?.seed || []).map(roundKey)}`
    )
    .join("|");
}
