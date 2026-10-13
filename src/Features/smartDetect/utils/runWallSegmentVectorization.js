// Orchestrator for the "Vectoriser" smart-detect run (V shortcut / « Lancer
// la détection » button of the clic-clic polyline helper).
//
// Vectorizes the black wall bands of the baseMap into 2-point POLYLINE
// segments:
//
//   1. Resolve the active stroke width from the in-progress annotation
//      (template or toolbar override) and convert it to image-pixels — the
//      worker only keeps the bands whose thickness matches it (± tolerance).
//   2. Build an exclusion mask of existing annotations so already-annotated
//      walls are ignored.
//   3. Dispatch the worker handler picked by `engine`:
//        - "CENTERLINES" (default): detectWallCenterlinesAsync — thickness
//          filter → skeleton → ordered chains → RDP split + total-least-
//          squares fit → collinear merge → corner join. Any angle.
//        - "SEGMENTS": detectWallSegmentsAsync — the former fixed-width
//          H / V-only detector, kept for comparison (no UI caller).
//   4. Convert each detected wall (image-pixel coords) into the same feature
//      shape as runGlobalFloorPlanDetection (polygon in local-viewport px
//      for the transient flash layer, 2-point centerline in image-px for the
//      bulk-create hook) — so the display / Space-commit plumbing is reused
//      as-is.
//
// Features carry NO per-feature strokeWidth override: the committed
// segments must have exactly the thickness picked in the bottom toolbar /
// template (the bulk-create hook then falls back to the sourceAnnotation
// props). The worker's measured thickness is only used to gate the bands;
// the preview polygon is built with the target thickness so the green
// flash shows the exact footprint of the annotations about to be drawn.
//
// Cancellation is best-effort: the worker call itself cannot be aborted
// once dispatched, but `signal.aborted` is checked before / after to skip
// post-processing when the user has hit Escape.

import cv from "Features/opencv/services/opencvService";
import buildExclusionMask from "Features/smartDetect/utils/buildExclusionMask";
import { resolveTargetThicknessPx } from "Features/smartDetect/utils/runGlobalFloorPlanDetection";

// Same ratios as the "Globale" (A) mode — tolerance band around the target
// thickness and minimum wall length as a multiple of it.
const TOLERANCE_RATIO = 0.3;
const MIN_WALL_LENGTH_RATIO = 4;

export default async function runWallSegmentVectorization({
  signal,
  baseMap,
  annotations,
  newAnnotation,
  imageScale,
  imageOffset,
  meterByPx,
  engine = "CENTERLINES",
  orthoSnapAngleOffsetDeg = 0,
}) {
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  const imageUrl = baseMap?.getUrl?.();
  if (!imageUrl) throw new Error("baseMap has no image URL");

  const imageSize = baseMap?.getImageSize?.();
  if (!imageSize?.width || !imageSize?.height) {
    throw new Error("baseMap has no imageSize");
  }

  const targetThicknessPx = resolveTargetThicknessPx({
    newAnnotation,
    meterByPx,
    imageScale,
  });

  const tolerance = Math.max(
    2,
    Math.round(targetThicknessPx * TOLERANCE_RATIO)
  );
  const minWallLength = Math.max(
    20,
    Math.round(targetThicknessPx * MIN_WALL_LENGTH_RATIO)
  );

  // Build the exclusion mask from current annotations (same coords as the
  // STRIP detection path).
  const mask = buildExclusionMask(
    annotations || [],
    imageSize,
    imageScale,
    imageOffset || { x: 0, y: 0 },
    meterByPx || 0,
    null
  );

  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  // Make sure OpenCV is loaded before dispatching.
  await cv.load();

  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  const payload = {
    imageUrl,
    targetThickness: targetThicknessPx,
    tolerance,
    minWallLength,
    exclusionMaskBuffer: mask.buffer,
    maskWidth: imageSize.width,
    maskHeight: imageSize.height,
  };

  const result =
    engine === "SEGMENTS"
      ? await cv.detectWallSegmentsAsync(payload)
      : await cv.detectWallCenterlinesAsync({
          ...payload,
          orthoSnapAngleOffsetDeg,
        });

  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  const safeImageScale = imageScale || 1;
  const safeImageOffset = imageOffset || { x: 0, y: 0 };

  const imageToLocal = (pt) => ({
    x: pt.x * safeImageScale + safeImageOffset.x,
    y: pt.y * safeImageScale + safeImageOffset.y,
  });

  // Preview rectangle uses the TARGET thickness (not the measured one):
  // the committed annotations keep the toolbar / template strokeWidth, so
  // the green flash must show that exact footprint, centered on the black
  // band. Oriented rectangle: half thickness along the unit normal.
  const segmentToFeature = (wall) => {
    const half = targetThicknessPx / 2;
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    const rectImg = [
      { x: wall.x1 + nx, y: wall.y1 + ny },
      { x: wall.x2 + nx, y: wall.y2 + ny },
      { x: wall.x2 - nx, y: wall.y2 - ny },
      { x: wall.x1 - nx, y: wall.y1 - ny },
    ];
    return {
      kind: "WALL",
      closeLine: false,
      polygon: rectImg.map(imageToLocal),
      centerline: [
        { x: wall.x1, y: wall.y1 },
        { x: wall.x2, y: wall.y2 },
      ],
      // No strokeWidth override — the bulk-create hook falls back to the
      // sourceAnnotation (toolbar / template) thickness.
    };
  };

  const walls = [
    ...(result.walls || []),
    ...(result.horizontalWalls || []),
    ...(result.verticalWalls || []),
  ];
  const features = walls.map(segmentToFeature);

  return { features, imageSize: result.imageSize ?? imageSize };
}
