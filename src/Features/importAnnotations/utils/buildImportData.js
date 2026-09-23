import { nanoid } from "@reduxjs/toolkit";

import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";
import { pickStyle } from "./importStyleFields";

const FREE_TEXT_DEFAULT_FONT_SIZE = 14;

/**
 * Compute pixel-per-normalized-unit factors so the imported drawing keeps its
 * real-world size when pasted onto the target (calibration) baseMap.
 *
 * Source meters/px = widthMeters / image.width. To match real size on the
 * target whose meters/px is `mbpxTarget`, a normalized delta maps to:
 *   px.x = norm.x * widthMeters / mbpxTarget
 *   px.y = norm.y * (image.height/image.width) * widthMeters / mbpxTarget
 *
 * When `relativeToBaseMap` is set, the normalized [0..1] coordinates are mapped
 * straight onto the target baseMap pixel space (norm * baseMap.{width,height}),
 * ignoring real-world scale. This is the right mode when the drawing was traced
 * from the very plan used as the baseMap: the outline then overlays the plan
 * exactly. Falls back to source pixels if the baseMap image size is unknown.
 *
 * When scale cannot be deduced (no widthMeters or uncalibrated baseMap), fall
 * back to source pixels (norm * image.{width,height}) — best effort, no real
 * scale.
 */
function getPxPerNorm({
  image,
  widthMeters,
  mbpxTarget,
  relativeToBaseMap,
  baseMapImageSize,
}) {
  const aspect = image.height / image.width;
  if (
    relativeToBaseMap &&
    baseMapImageSize?.width > 0 &&
    baseMapImageSize?.height > 0
  ) {
    return {
      pxPerNormX: baseMapImageSize.width,
      pxPerNormY: baseMapImageSize.height,
      scaled: true,
      relative: true,
    };
  }
  if (widthMeters > 0 && mbpxTarget > 0) {
    const pxPerNormX = widthMeters / mbpxTarget;
    return { pxPerNormX, pxPerNormY: pxPerNormX * aspect, scaled: true };
  }
  return { pxPerNormX: image.width, pxPerNormY: image.height, scaled: false };
}

// STRIP band half/full width in TARGET pixels, for the paste ghost. Mirrors
// the live editor's getStripDistancePx: CM widths convert via target meterByPx;
// PX widths are used as-is.
function computeStripWidthPx(style, mbpxTarget) {
  const strokeWidth = style.strokeWidth ?? 20;
  const unit = style.strokeWidthUnit ?? "PX";
  if (unit === "CM" && mbpxTarget > 0) {
    return Math.abs((strokeWidth * 0.01) / mbpxTarget);
  }
  return Math.abs(strokeWidth);
}

// FREE_TEXT `fontSize` is a page-point size relative to the WHOLE image (see
// getFreeTextPageScale): unlike the geometry it does not follow the real-scale
// mapping by itself. When the drawing is placed at real scale on a target whose
// long side (in meters) differs from the source's, rescale it so the text keeps
// its real-world height next to the shapes it was laid out with.
function getFreeTextFontFactor({
  image,
  widthMeters,
  mbpxTarget,
  baseMapImageSize,
  scaled,
  relative,
}) {
  if (!scaled || relative) return 1;
  if (!(baseMapImageSize?.width > 0) || !(baseMapImageSize?.height > 0))
    return 1;
  const sourceLongM = widthMeters * Math.max(1, image.height / image.width);
  const targetLongM =
    mbpxTarget * Math.max(baseMapImageSize.width, baseMapImageSize.height);
  const factor = sourceLongM / targetLongM;
  if (!Number.isFinite(factor) || factor <= 0) return 1;
  return Math.abs(factor - 1) < 1e-6 ? 1 : factor;
}

// Normalized [0..1] → target pixels, carrying the ref flags (arc `type`, per
// vertex Z offsets) and `sourceId` — the latter is what lets
// pasteAnnotationService weld the annotations that share a source point.
function toBasePoints(points, pxPerNormX, pxPerNormY) {
  return (points ?? []).map((p) => ({
    ...p,
    x: p.x * pxPerNormX,
    y: p.y * pxPerNormY,
  }));
}

// The ref array parallel to basePoints. pasteAnnotationService reads `type` and
// the offsets off it (they live on the inline ref, never on the db.points row).
function toPointRefs(points) {
  return (points ?? []).map((p) => ({
    ...(p.type ? { type: p.type } : {}),
    ...(p.offsetTop ? { offsetTop: p.offsetTop } : {}),
    ...(p.offsetBottom ? { offsetBottom: p.offsetBottom } : {}),
  }));
}

/**
 * Turn parsed inline JSON into a `clipboard: { sourceCenter, items }` feeding
 * the existing paste-ghost flow. Template rows are resolved upstream by
 * resolveImportTemplatesService and injected here as `templateIdMap`.
 *
 * @param {Object} params
 * @param {Object} params.data        - parsed + validated inline JSON (or normalized dump)
 * @param {number} params.widthMeters - real-world image width (m), or undefined
 * @param {Object} params.mainBaseMap - target/calibration BaseMap instance
 * @param {string} params.projectId
 * @param {string} params.listingId
 * @param {Map<string,string>} params.templateIdMap - source template id → db id
 * @returns {{ clipboard: Object, scaled: boolean, relative: boolean }}
 */
export default function buildImportData({
  data,
  widthMeters,
  mainBaseMap,
  projectId,
  listingId,
  excludedTemplateIds,
  relativeToBaseMap,
  templateIdMap,
}) {
  const image = data.image;
  const mbpxTarget = mainBaseMap?.getMeterByPx?.() ?? null;
  const baseMapImageSize =
    mainBaseMap?.getImageSize?.() || mainBaseMap?.image?.imageSize || null;
  const { pxPerNormX, pxPerNormY, scaled, relative } = getPxPerNorm({
    image,
    widthMeters,
    mbpxTarget,
    relativeToBaseMap,
    baseMapImageSize,
  });

  const freeTextFontFactor = getFreeTextFontFactor({
    image,
    widthMeters,
    mbpxTarget,
    baseMapImageSize,
    scaled,
    relative,
  });

  const excluded = new Set(excludedTemplateIds ?? []);
  const baseMapId = mainBaseMap?.id;
  const items = [];
  const allBasePoints = [];

  for (const ann of data.annotations) {
    // Skip annotations whose template was excluded from the import.
    if (ann.annotationTemplateId && excluded.has(ann.annotationTemplateId)) {
      continue;
    }

    const newTplId = ann.annotationTemplateId
      ? templateIdMap?.get(ann.annotationTemplateId)
      : undefined;
    const tplDef = (data.annotationTemplates || []).find(
      (t) => t.id === ann.annotationTemplateId
    );

    // The dump format ships full DB rows, already scrubbed of the hydrated
    // fields by normalizeAnnotationsDumpJson — take them verbatim, so nothing
    // is silently dropped. The inline-JSON format has no row, only style keys:
    // merge template first, then annotation-level overrides.
    const style = ann.props ?? { ...pickStyle(tplDef), ...pickStyle(ann) };

    const annotation = {
      ...style,
      // Kept from the source: pasteAnnotationService mints a fresh id at write
      // time but uses this one to clone the source's mapping-category rows.
      id: ann.id ?? nanoid(),
      type: ann.type,
      projectId,
      listingId,
      baseMapId,
      drawingShape: resolveDrawingShapeFromType(ann.type),
      ...(newTplId ? { annotationTemplateId: newTplId } : {}),
      ...(ann.closeLine !== undefined ? { closeLine: ann.closeLine } : {}),
    };

    const item = { annotation };

    if (ann.type === "FREE_TEXT") {
      // LABEL geometry family: two inline anchors, no db.points rows.
      // `labelPoint` is the CENTRE of the text box (NodeFreeTextStatic).
      const label = ann.labelPoint ?? ann.targetPoint;
      const [baseLabelPoint, baseTargetPoint] = toBasePoints(
        [label, ann.targetPoint ?? label],
        pxPerNormX,
        pxPerNormY
      );
      item.baseLabelPoint = baseLabelPoint;
      item.baseTargetPoint = baseTargetPoint;
      // Paste ghost: fontSize is relative to the TARGET image long side.
      item.imageLongSidePx = Math.max(
        baseMapImageSize?.width ?? image.width,
        baseMapImageSize?.height ?? image.height
      );
      allBasePoints.push(baseLabelPoint, baseTargetPoint);
      if (ann.textContent !== undefined) {
        annotation.textContent = ann.textContent;
      }
      if (freeTextFontFactor !== 1) {
        const fontSize = annotation.fontSize ?? FREE_TEXT_DEFAULT_FONT_SIZE;
        annotation.fontSize =
          Math.round(fontSize * freeTextFontFactor * 100) / 100;
      }
    } else if (ann.point) {
      // Single-point family (POINT / MARKER / DETAIL).
      const [basePoint] = toBasePoints([ann.point], pxPerNormX, pxPerNormY);
      item.basePoint = basePoint;
      allBasePoints.push(basePoint);
    } else {
      const basePoints = toBasePoints(ann.points, pxPerNormX, pxPerNormY);
      item.basePoints = basePoints;
      allBasePoints.push(...basePoints);
      // points refs carry the arc `type` flag and the per-vertex Z offsets
      // (parallel to basePoints) so pasteAnnotationService preserves them.
      annotation.points = toPointRefs(ann.points);

      if (ann.guideLines?.length) {
        item.baseGuideLines = ann.guideLines.map((g) => ({
          ...g,
          points: toBasePoints(g.points, pxPerNormX, pxPerNormY),
        }));
      }
      if (ann.openings?.length) {
        item.baseOpenings = ann.openings.map((o) => ({
          ...o,
          points: toBasePoints(o.points, pxPerNormX, pxPerNormY),
        }));
      }
      if (ann.cuts?.length) {
        item.baseCuts = ann.cuts.map((cut) => ({
          points: toBasePoints(cut.points, pxPerNormX, pxPerNormY),
        }));
        annotation.cuts = ann.cuts.map((cut) => ({
          points: toPointRefs(cut.points),
        }));
      }
    }

    // STRIP ghost needs the band width (target px) + orientation.
    if (ann.type === "STRIP") {
      item.stripWidthPx = computeStripWidthPx(style, mbpxTarget);
      item.stripOrientation = style.stripOrientation ?? 1;
    }

    items.push(item);
  }

  // Group source center = bbox center of all basePoints
  let sourceCenter = { x: 0, y: 0 };
  if (allBasePoints.length) {
    const xs = allBasePoints.map((p) => p.x);
    const ys = allBasePoints.map((p) => p.y);
    sourceCenter = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  }

  return {
    clipboard: { sourceCenter, items },
    scaled,
    relative: Boolean(relative),
  };
}
