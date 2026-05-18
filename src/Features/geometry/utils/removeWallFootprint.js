import {
  extractExteriorRing,
  WALL_DETECTION_M,
} from "Features/geometry/utils/classifyRingContours";
import isWallCut from "Features/geometry/utils/isWallCut";

// Used when the base map has no scale (meterByPx unknown).
const FALLBACK_THICKNESS_PX = 16;
// Cut-removal threshold = a bit above the nominal wall thickness, so slightly
// noisy ~20cm slots are still caught while genuine voids stay.
const CUT_THRESHOLD_FACTOR = 1.25;

/**
 * "Remove wall footprint" on a POLYGON:
 *  - re-derive the exterior contour (fills concave wall notches), and
 *  - drop the `cuts` that are thin wall slots, keeping genuine voids.
 *
 * All coordinates are in reference pixel space.
 *
 * @param {object} args
 * @param {Array<{x,y,id}>} args.pointsPx - outer ring (with point ids)
 * @param {Array<{points:Array<{x,y}>}>} args.cutsPx - hole rings
 * @param {number|null} args.meterByPx - meters per reference pixel (may be null)
 * @param {number} args.wallCm - nominal wall thickness in centimeters
 * @returns {{ outerPx: Array<{x,y}>, cutsPx: Array<{points:Array<{x,y}>}> }|null}
 */
export default function removeWallFootprint({
  pointsPx,
  cutsPx,
  meterByPx,
  wallCm,
}) {
  if (!pointsPx || pointsPx.length < 3) return null;

  const thicknessPx =
    meterByPx > 0 ? wallCm / 100 / meterByPx : FALLBACK_THICKNESS_PX;
  if (!(thicknessPx > 0)) return null;

  // Scale used by the contour scanner. With a real scale, use it (proven
  // WALL_DETECTION_M default). Without one, synthesize a scale so the wall
  // detection distance lands at a sensible multiple of the wall thickness.
  const effMeterByPx =
    meterByPx > 0 ? meterByPx : WALL_DETECTION_M / (3 * thicknessPx);

  const exterior = extractExteriorRing(pointsPx, effMeterByPx);
  const outerPx = exterior || pointsPx.map((p) => ({ x: p.x, y: p.y }));

  const cutThresholdPx = thicknessPx * CUT_THRESHOLD_FACTOR;
  const survivingCutsPx = (cutsPx ?? [])
    .filter((c) => c?.points?.length >= 3)
    .filter((c) => !isWallCut(c.points, cutThresholdPx))
    .map((c) => ({ points: c.points.map((p) => ({ x: p.x, y: p.y })) }));

  return { outerPx, cutsPx: survivingCutsPx };
}
