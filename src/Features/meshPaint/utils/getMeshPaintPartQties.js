// Quantity of ONE painted part — node-testable (relative imports only).
//
// FACE → surface (m², one painted side: the two sides of a thin wall are two
// parts, each counted), EDGE → length (ml). The part type decides, whatever
// the template type is now (a template whose type changed is dropped
// upstream by resolveMeshPaints).
import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";
import { paintGeometryToLocal } from "./meshPaintFrame.js";
import { edgeLength, faceArea } from "./meshPaintGeometry.js";

const DISABLED = Object.freeze({ enabled: false, surface: 0, length: 0 });

/**
 * @param {{partType: "FACE"|"EDGE", geometry: Object}} paint - stored row
 *   (or candidate).
 * @param {{imageWidth, imageHeight, meterByPx} | null} metrics - see
 *   getMeshPaintMetrics; null → no quantity (base map without scale).
 * @returns {{enabled: boolean, surface: number, length: number}}
 */
export default function getMeshPaintPartQties(paint, metrics) {
  if (!metrics || !paint?.geometry) return DISABLED;
  try {
    const local = paintGeometryToLocal(paint.partType, paint.geometry, metrics);
    if (!local) return DISABLED;
    if (paint.partType === MESH_PAINT_PART_TYPES.FACE) {
      const surface = faceArea(local);
      return Number.isFinite(surface)
        ? { enabled: true, surface, length: 0 }
        : DISABLED;
    }
    if (paint.partType === MESH_PAINT_PART_TYPES.EDGE) {
      const length = edgeLength(local);
      return Number.isFinite(length)
        ? { enabled: true, surface: 0, length }
        : DISABLED;
    }
  } catch {
    // malformed geometry: listed without quantity
  }
  return DISABLED;
}
