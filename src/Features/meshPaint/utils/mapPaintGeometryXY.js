import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";

// Maps the plan coordinates [nx, ny] of every stored point of a painted part
// through `mapXY({x, y}) → {x, y}` (normalized → normalized), z kept.
//
// For frame changes that are a translation + a uniform scale compensated by
// meterByPx (« Régénérer depuis le PDF »): local-meter directions are
// invariant, so the FACE normal and the EDGE sides are kept as they are.
//
// Pure: node-testable.

const mapPoint = (p, mapXY) => {
  if (!Array.isArray(p)) return p;
  const next = mapXY({ x: p[0], y: p[1] });
  return [next.x, next.y, p[2]];
};

export default function mapPaintGeometryXY(partType, geometry, mapXY) {
  if (!geometry || typeof mapXY !== "function") return geometry;
  if (partType === MESH_PAINT_PART_TYPES.EDGE) {
    return {
      ...geometry,
      points: (geometry.points ?? []).map((p) => mapPoint(p, mapXY)),
    };
  }
  return {
    ...geometry,
    polygons: (geometry.polygons ?? []).map((polygon) => ({
      ...polygon,
      contour: (polygon.contour ?? []).map((p) => mapPoint(p, mapXY)),
      holes: (polygon.holes ?? []).map((hole) =>
        (hole ?? []).map((p) => mapPoint(p, mapXY))
      ),
    })),
  };
}
