import getLayerStackProfile from "Features/geometry/utils/getLayerStackProfile";
import offsetPolylineVariable from "Features/geometry/utils/offsetPolylineVariable";
import { getStripChunks } from "Features/geometry/utils/getStripePolygons";
import { getStripWidthPx } from "Features/annotations/utils/convertStripPolyline";
import { sortLayerStrips } from "./layerStackOrder";

// Display-only stacking of layer STRIPs (`isLayer`).
//
// All layer strips of a base map are DRAWN on the same support lines; at
// render time each one is offset perpendicularly by the accumulated full
// thickness of the layers beneath it (stack order = layerIndex, fallback
// createdAt), with 45° ramps where an underlying layer ends. Stored points are
// never touched — callers substitute the returned points for display only.
//
// The offset side is the strip's own band side: the profile distance is signed
// with `stripOrientation`, matching getStripDistancePx / the ribbon offset.

// A layer whose own polyline has arcs, a closure or hidden segments renders
// unstacked: inserted ramp vertices would corrupt the S-C-S triplets and the
// per-segment indices (hiddenSegmentsIdx, SEG:: partIds).
function isStackable(annotation) {
  if (annotation.closeLine) return false;
  if (annotation.hiddenSegmentsIdx?.length) return false;
  if (annotation.points.some((p) => p?.type === "circle")) return false;
  return !getStripChunks(annotation).effectiveCloseLine;
}

/**
 * @param {Array} annotations - resolved annotations (pixel points)
 * @param {Object} options
 * @param {string} options.baseMapId
 * @param {number} options.meterByPx
 * @returns {Map<string, Array>} annotation id → stacked display points
 */
export default function applyLayerStackingToAnnotations(
  annotations,
  { baseMapId, meterByPx } = {}
) {
  const result = new Map();

  const layers = sortLayerStrips(
    (annotations || []).filter(
      (a) =>
        a?.type === "STRIP" &&
        a?.isLayer &&
        a?.baseMapId === baseMapId &&
        !a?.isForeignFootprint &&
        (a?.points?.length ?? 0) >= 2
    )
  );
  if (layers.length < 2) return result;

  for (let k = 1; k < layers.length; k++) {
    const layer = layers[k];
    if (!isStackable(layer)) continue;

    const underlying = layers.slice(0, k).map((u) => ({
      // Hidden segments of an underlying layer contribute NO thickness.
      chunks: getStripChunks(u).chunks,
      thicknessPx: getStripWidthPx(u, meterByPx),
    }));

    const profile = getLayerStackProfile(layer.points, underlying);
    if (!profile) continue;

    const sign = (layer.stripOrientation ?? 1) >= 0 ? 1 : -1;
    const signedProfile =
      sign === 1 ? profile : profile.map(({ s, d }) => ({ s, d: -d }));

    result.set(layer.id, offsetPolylineVariable(layer.points, signedProfile));
  }

  return result;
}
