import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";

// « Pinceau » → 2D annotation: what a picked part (base-map-LOCAL geometry,
// meshBrushPick / commitMeshBrushTargetService) can become when the brush
// prefers a 2D annotation over a db.meshPaints row (mapEditor
// .meshBrushCreate2dIfPossible). Cheap and synchronous: the hover label and
// the commit share it.
//
// kinds:
//   WALL_BAND    lateral facet of a thick wall (POLYLINE in CM / STRIP): a
//                vertical band glued to the floor polygons at its foot
//                (matchWallFaceToGroundPolygons). `footprint` = the facet's
//                plan segment, `sideNormal2d` toward the painted side,
//                `topZ` = top of the facet.
//   FACE_2D      any other planar facet: commitDrawnFace decides the plan
//                encoding (PARALLEL polygon, exact vertical band, OBLIQUE).
//   POLYLINE_2D  horizontal edge: a POLYLINE at its level.
//   PAINT        no 2D encoding (curved surface, multi-polygon facet, sloped
//                or vertical edge): the paint row stands.
//
// Pure: node-testable, relative imports only.

export const BRUSH_2D_KIND = Object.freeze({
  WALL_BAND: "WALL_BAND",
  FACE_2D: "FACE_2D",
  POLYLINE_2D: "POLYLINE_2D",
  PAINT: "PAINT",
});

export const BRUSH_2D_REASON = Object.freeze({
  CURVED: "CURVED",
  MULTI_POLYGON: "MULTI_POLYGON",
  SLOPED_EDGE: "SLOPED_EDGE",
  NO_GEOMETRY: "NO_GEOMETRY",
});

// An edge is horizontal when its z spread stays under this (m).
export const EDGE_FLAT_TOL_M = 5e-3;
// A facet is lateral (vertical) when |normal.z| < sin(5°).
const LATERAL_MAX_NZ = Math.sin((5 * Math.PI) / 180);
// A closed curve repeats its first point (meshPaintFrame): weld tolerance.
const CLOSE_TOL_M = 1e-4;

const paint = (reason) => ({ kind: BRUSH_2D_KIND.PAINT, reason });

export function isLateralNormal(normal) {
  if (!normal) return false;
  const len = Math.hypot(normal.x || 0, normal.y || 0, normal.z || 0);
  if (len < 1e-9) return false;
  return Math.abs((normal.z || 0) / len) < LATERAL_MAX_NZ;
}

// Plan segment of a vertical facet: the two contour vertices farthest apart
// in (x, y) — a vertical facet projects on a line, its extreme points are
// the segment ends.
export function getFaceFootprintSegment(contour) {
  if (!contour || contour.length < 2) return null;
  let best = null;
  let bestD = -1;
  for (let i = 0; i < contour.length; i++) {
    for (let j = i + 1; j < contour.length; j++) {
      const d = Math.hypot(
        contour[j].x - contour[i].x,
        contour[j].y - contour[i].y
      );
      if (d > bestD) {
        bestD = d;
        best = {
          a: { x: contour[i].x, y: contour[i].y },
          b: { x: contour[j].x, y: contour[j].y },
        };
      }
    }
  }
  return bestD > 1e-6 ? best : null;
}

export function getFaceZRange(polygons) {
  let min = Infinity;
  let max = -Infinity;
  for (const polygon of polygons || []) {
    for (const loop of [polygon.contour, ...(polygon.holes || [])]) {
      for (const p of loop || []) {
        if (p.z < min) min = p.z;
        if (p.z > max) max = p.z;
      }
    }
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/**
 * @param {"FACE"|"EDGE"} partType
 * @param {Object} localGeometry - LocalFace {polygons, normal, curved?} or
 *   LocalEdge {points, sides?, angleDeg?} (base-map-local meters)
 * @param {{isThickWallHost?: boolean}} options
 * @returns {{kind: string, reason?: string, footprint?: {a, b}, sideNormal2d?: {x, y}, topZ?: number, bottomZ?: number, closeLine?: boolean}}
 */
export default function classifyMeshBrushLocalPart(
  partType,
  localGeometry,
  { isThickWallHost = false } = {}
) {
  if (!localGeometry) return paint(BRUSH_2D_REASON.NO_GEOMETRY);

  if (partType === MESH_PAINT_PART_TYPES.EDGE) {
    const points = localGeometry.points || [];
    if (points.length < 2) return paint(BRUSH_2D_REASON.NO_GEOMETRY);
    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
      if (p.z < min) min = p.z;
      if (p.z > max) max = p.z;
    }
    if (max - min > EDGE_FLAT_TOL_M) return paint(BRUSH_2D_REASON.SLOPED_EDGE);
    const first = points[0];
    const last = points[points.length - 1];
    const closeLine =
      points.length > 3 &&
      Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z) <
        CLOSE_TOL_M;
    return { kind: BRUSH_2D_KIND.POLYLINE_2D, closeLine };
  }

  if (localGeometry.curved) return paint(BRUSH_2D_REASON.CURVED);
  const polygons = localGeometry.polygons || [];
  if (polygons.length !== 1) {
    return paint(
      polygons.length
        ? BRUSH_2D_REASON.MULTI_POLYGON
        : BRUSH_2D_REASON.NO_GEOMETRY
    );
  }
  const [polygon] = polygons;
  if (!(polygon?.contour?.length >= 3)) {
    return paint(BRUSH_2D_REASON.NO_GEOMETRY);
  }

  const normal = localGeometry.normal;
  if (isThickWallHost && isLateralNormal(normal)) {
    const footprint = getFaceFootprintSegment(polygon.contour);
    const range = getFaceZRange(polygons);
    if (footprint && range) {
      const len = Math.hypot(normal.x || 0, normal.y || 0);
      return {
        kind: BRUSH_2D_KIND.WALL_BAND,
        footprint,
        sideNormal2d: { x: (normal.x || 0) / len, y: (normal.y || 0) / len },
        topZ: range.max,
        bottomZ: range.min,
      };
    }
  }

  return { kind: BRUSH_2D_KIND.FACE_2D };
}
