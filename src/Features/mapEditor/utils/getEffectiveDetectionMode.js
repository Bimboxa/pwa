/**
 * Derives the currently-active auto-detection algorithm from the
 * selected drawing tool and the global smart-detect switch.
 *
 * Returns one of:
 *   - "RECTANGLE" : OpenCV rectangle detection in the loupe
 *   - "STRIP"     : JS strip detection in the loupe (edge points + stripOrientation)
 *   - "SEGMENT"   : JS strip detection in the loupe (median axis, polyline)
 *   - "SURFACE"   : polygon detection from existing annotations (no loupe)
 *   - null        : no detection
 */
const RECTANGLE_MODES = [
  "POLYLINE_RECTANGLE",
  "POLYGON_RECTANGLE",
  "CUT_RECTANGLE",
  "RECTANGLE",
];

export default function getEffectiveDetectionMode({
  enabledDrawingMode,
  smartDetectEnabled,
}) {
  if (!smartDetectEnabled) return null;
  if (RECTANGLE_MODES.includes(enabledDrawingMode)) return "RECTANGLE";
  if (enabledDrawingMode === "STRIP") return "STRIP";
  if (enabledDrawingMode === "POLYLINE_CLICK") return "SEGMENT";
  if (enabledDrawingMode === "POLYGON_CLICK") return "SURFACE";
  return null;
}
