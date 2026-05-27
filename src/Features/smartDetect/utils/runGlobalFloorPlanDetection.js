// Orchestrator for the "Globale" smart-detect mode (A shortcut).
//
// Pipeline:
//   1. Resolve the active stroke width from the in-progress annotation
//      (template or toolbar override) and convert it to image-pixels.
//   2. Build an exclusion mask of existing annotations (same util used by
//      STRIP / polygon detection) so already-annotated walls / pillars are
//      ignored.
//   3. Dispatch detectFloorPlanFeaturesAsync to the OpenCV worker, with the
//      mask buffer attached.
//   4. Convert each detected wall / pillar (image-pixel coords) into a
//      feature object carrying:
//        - `polygon`  — 4-corner outline in **local-viewport pixels** for
//                       the transient flash layer
//        - `centerline` — pixel points in **image-pixel** coords, ready for
//                       the bulk-create hook (which divides by image size to
//                       normalize before writing to db.points)
//        - `closeLine` — true for pillars (4-corner closed POLYLINE),
//                        false for walls (open 2-point POLYLINE)
//        - `strokeWidth` / `strokeWidthUnit` — the measured thickness in CM
//                       (only when meterByPx is known)
//
// Cancellation is best-effort: the worker call itself cannot be aborted
// once dispatched, but `signal.aborted` is checked before / after to skip
// post-processing when the user has hit Escape.

import cv from "Features/opencv/services/opencvService";
import buildExclusionMask from "Features/smartDetect/utils/buildExclusionMask";

// Tolerance and min wall length, expressed as ratios of targetThickness.
// Same heuristic the user provided — works well for typical floor plans
// where walls are 4-6× the pillar / wall thickness.
const TOLERANCE_RATIO = 0.3;
const MIN_WALL_LENGTH_RATIO = 4;

// Minimum fraction of foreground (= originally black) pixels inside a
// width × width sample square — see the worker handler for the full rule.
// 0.75 is lenient enough to keep walls that cross labels / cotes; raise
// to ~0.9 on very clean vector exports.
const DEFAULT_DENSITY_THRESHOLD = 0.75;
// How many of the 3 sample squares along a wall must reach the density
// threshold for the wall to be kept. 2-of-3 tolerates a single
// interruption (door, perpendicular crossing).
const DEFAULT_DENSITY_MIN_PASSING_SAMPLES = 2;

function resolveTargetThicknessPx({
  newAnnotation,
  meterByPx,
  imageScale,
}) {
  const sw = newAnnotation?.strokeWidth ?? 20;
  const unit = newAnnotation?.strokeWidthUnit ?? "PX";
  if (unit === "CM" && meterByPx > 0) {
    // cm → m → image-px
    return Math.max(1, Math.abs((sw * 0.01) / meterByPx));
  }
  // Template "PX" is interpreted as local-viewport pixels (same convention
  // as the strip-detection path). Convert to image-pixels by dividing by
  // the image-in-local scale factor.
  return Math.max(1, Math.abs(sw / (imageScale || 1)));
}

function imageToLocal(pt, imageScale, imageOffset) {
  return {
    x: pt.x * imageScale + imageOffset.x,
    y: pt.y * imageScale + imageOffset.y,
  };
}

function wallToFeature(wall, isHorizontal, imageScale, imageOffset, meterByPx) {
  const half = wall.thickness / 2;
  // 4-corner rectangle around the wall axis (image-pixel coords)
  const rectImg = isHorizontal
    ? [
        { x: wall.x1, y: wall.y1 - half },
        { x: wall.x2, y: wall.y2 - half },
        { x: wall.x2, y: wall.y2 + half },
        { x: wall.x1, y: wall.y1 + half },
      ]
    : [
        { x: wall.x1 - half, y: wall.y1 },
        { x: wall.x2 - half, y: wall.y2 },
        { x: wall.x2 + half, y: wall.y2 },
        { x: wall.x1 + half, y: wall.y1 },
      ];
  const polygonLocal = rectImg.map((p) =>
    imageToLocal(p, imageScale, imageOffset),
  );
  // Centerline in image-pixels — fed to the bulk-create hook which
  // normalizes by image size.
  const centerline = [
    { x: wall.x1, y: wall.y1 },
    { x: wall.x2, y: wall.y2 },
  ];
  // Round to the nearest whole CM — sub-cm precision is meaningless given
  // pixel-rounding noise in the morphology output and matches what a user
  // would expect when picking a wall thickness from a standard catalogue.
  const thicknessCm =
    meterByPx > 0 ? Math.round(wall.thickness * meterByPx * 100) : null;
  return {
    kind: "WALL",
    closeLine: false,
    polygon: polygonLocal,
    centerline,
    ...(thicknessCm != null && {
      strokeWidth: thicknessCm,
      strokeWidthUnit: "CM",
    }),
  };
}

function pillarToFeature(pillar, imageScale, imageOffset, meterByPx) {
  // Pillars are committed as 2-point POLYLINE segments — same shape as
  // walls. The segment runs along the pillar's longer axis (horizontal
  // for square or wide pillars, vertical otherwise) and its strokeWidth
  // equals the pillar's shorter dimension, so the rendered annotation
  // covers the full pillar bbox.
  const isHorizontal = pillar.width >= pillar.height;
  const lenPx = isHorizontal ? pillar.width : pillar.height;
  const thicknessPx = isHorizontal ? pillar.height : pillar.width;
  const halfLen = lenPx / 2;
  const centerline = isHorizontal
    ? [
        { x: pillar.x - halfLen, y: pillar.y },
        { x: pillar.x + halfLen, y: pillar.y },
      ]
    : [
        { x: pillar.x, y: pillar.y - halfLen },
        { x: pillar.x, y: pillar.y + halfLen },
      ];

  // Preview polygon — keep the full pillar bbox so the flashing-green
  // marker visually matches the detected area.
  const w = pillar.width / 2;
  const h = pillar.height / 2;
  const rectImg = [
    { x: pillar.x - w, y: pillar.y - h },
    { x: pillar.x + w, y: pillar.y - h },
    { x: pillar.x + w, y: pillar.y + h },
    { x: pillar.x - w, y: pillar.y + h },
  ];
  const polygonLocal = rectImg.map((p) =>
    imageToLocal(p, imageScale, imageOffset),
  );

  // Same whole-CM rounding as walls — see comment in wallToFeature.
  const thicknessCm =
    meterByPx > 0 ? Math.round(thicknessPx * meterByPx * 100) : null;

  return {
    kind: "PILLAR",
    closeLine: false,
    polygon: polygonLocal,
    centerline,
    ...(thicknessCm != null && {
      strokeWidth: thicknessCm,
      strokeWidthUnit: "CM",
    }),
  };
}

export default async function runGlobalFloorPlanDetection({
  signal,
  baseMap,
  annotations,
  newAnnotation,
  imageScale,
  imageOffset,
  meterByPx,
  densityThreshold = DEFAULT_DENSITY_THRESHOLD,
  densityMinPassingSamples = DEFAULT_DENSITY_MIN_PASSING_SAMPLES,
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

  const tolerance = Math.max(2, Math.round(targetThicknessPx * TOLERANCE_RATIO));
  const minWallLength = Math.max(
    20,
    Math.round(targetThicknessPx * MIN_WALL_LENGTH_RATIO),
  );

  // Build the exclusion mask from current annotations (same coords as the
  // STRIP detection path).
  const mask = buildExclusionMask(
    annotations || [],
    imageSize,
    imageScale,
    imageOffset || { x: 0, y: 0 },
    meterByPx || 0,
    null,
  );

  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  // Make sure OpenCV is loaded before dispatching.
  await cv.load();

  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  const result = await cv.detectFloorPlanFeaturesAsync({
    imageUrl,
    targetThickness: targetThicknessPx,
    tolerance,
    minWallLength,
    exclusionMaskBuffer: mask.buffer,
    maskWidth: imageSize.width,
    maskHeight: imageSize.height,
    densityThreshold,
    densityMinPassingSamples,
  });

  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  const safeImageScale = imageScale || 1;
  const safeImageOffset = imageOffset || { x: 0, y: 0 };

  const features = [];
  for (const w of result.horizontalWalls || []) {
    features.push(
      wallToFeature(w, true, safeImageScale, safeImageOffset, meterByPx || 0),
    );
  }
  for (const w of result.verticalWalls || []) {
    features.push(
      wallToFeature(w, false, safeImageScale, safeImageOffset, meterByPx || 0),
    );
  }
  for (const p of result.pillars || []) {
    features.push(
      pillarToFeature(p, safeImageScale, safeImageOffset, meterByPx || 0),
    );
  }

  return { features, imageSize: result.imageSize ?? imageSize };
}
