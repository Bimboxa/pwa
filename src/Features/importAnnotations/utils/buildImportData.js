import { nanoid } from "@reduxjs/toolkit";

import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";

// Style fields copied from an imported template onto each imported annotation,
// so both the paste ghost and the placed annotation render correctly even
// before the (newly created) template is resolved by the render layer.
const STYLE_FIELDS = [
  "fillColor",
  "fillOpacity",
  "fillType",
  "strokeColor",
  "strokeOpacity",
  "strokeWidth",
  "strokeWidthUnit",
  "strokeType",
  // STRIP (band width is carried by strokeWidth/strokeWidthUnit)
  "stripOrientation",
  // COTE
  "unit",
  "decimals",
  "fontSize",
  "showUnitLabel",
  "extensionOffset",
  "extensionOffsetUnit",
];

function pickStyle(obj) {
  const out = {};
  for (const key of STYLE_FIELDS) {
    if (obj?.[key] !== undefined && obj[key] !== null) out[key] = obj[key];
  }
  return out;
}

/**
 * Compute pixel-per-normalized-unit factors so the imported drawing keeps its
 * real-world size when pasted onto the target (calibration) baseMap.
 *
 * Source meters/px = widthMeters / image.width. To match real size on the
 * target whose meters/px is `mbpxTarget`, a normalized delta maps to:
 *   px.x = norm.x * widthMeters / mbpxTarget
 *   px.y = norm.y * (image.height/image.width) * widthMeters / mbpxTarget
 *
 * When scale cannot be deduced (no widthMeters or uncalibrated baseMap), fall
 * back to source pixels (norm * image.{width,height}) — best effort, no real
 * scale.
 */
function getPxPerNorm({ image, widthMeters, mbpxTarget }) {
  const aspect = image.height / image.width;
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

/**
 * Turn parsed inline JSON into:
 *  - templateRecords: full db.annotationTemplates rows (with new ids), ready to bulkAdd
 *  - clipboard: { sourceCenter, items } feeding the existing paste-ghost flow
 *
 * @param {Object} params
 * @param {Object} params.data        - parsed + validated inline JSON
 * @param {number} params.widthMeters - real-world image width (m), or undefined
 * @param {Object} params.mainBaseMap - target/calibration BaseMap instance
 * @param {string} params.projectId
 * @param {string} params.listingId
 * @returns {{ templateRecords: Object[], clipboard: Object, scaled: boolean }}
 */
export default function buildImportData({
  data,
  widthMeters,
  mainBaseMap,
  projectId,
  listingId,
  excludedTemplateIds,
}) {
  const image = data.image;
  const mbpxTarget = mainBaseMap?.getMeterByPx?.() ?? null;
  const { pxPerNormX, pxPerNormY, scaled } = getPxPerNorm({
    image,
    widthMeters,
    mbpxTarget,
  });

  const excluded = new Set(excludedTemplateIds ?? []);
  const includedTemplates = (data.annotationTemplates || []).filter(
    (t) => !excluded.has(t.id)
  );

  // 1. New template ids + records (source local id → new db id)
  const templateIdMap = new Map();
  const templateRecords = includedTemplates.map((tpl) => {
    const id = nanoid();
    templateIdMap.set(tpl.id, id);
    const style = pickStyle(tpl);
    const record = {
      ...style,
      id,
      projectId,
      listingId,
      label: tpl.label ?? tpl.type,
      type: tpl.type,
      drawingShape: tpl.drawingShape ?? resolveDrawingShapeFromType(tpl.type),
    };
    record.code = getAnnotationTemplateCode({
      annotation: record,
      listingKey: listingId,
    });
    return record;
  });

  // 2. Clipboard items (annotation + scaled basePoints in target px)
  const baseMapId = mainBaseMap?.id;
  const items = [];
  const allBasePoints = [];

  for (const ann of data.annotations) {
    // Skip annotations whose template was excluded from the import.
    if (ann.annotationTemplateId && excluded.has(ann.annotationTemplateId)) {
      continue;
    }

    const newTplId = ann.annotationTemplateId
      ? templateIdMap.get(ann.annotationTemplateId)
      : undefined;
    const tplDef = (data.annotationTemplates || []).find(
      (t) => t.id === ann.annotationTemplateId
    );

    const basePoints = ann.points.map((p) => ({
      x: p.x * pxPerNormX,
      y: p.y * pxPerNormY,
      ...(p.type ? { type: p.type } : {}),
    }));
    allBasePoints.push(...basePoints);

    // Style: template first, then annotation-level overrides.
    const style = { ...pickStyle(tplDef), ...pickStyle(ann) };

    const annotation = {
      ...style,
      id: nanoid(),
      type: ann.type,
      projectId,
      listingId,
      baseMapId,
      drawingShape: resolveDrawingShapeFromType(ann.type),
      ...(newTplId ? { annotationTemplateId: newTplId } : {}),
      ...(ann.closeLine !== undefined ? { closeLine: ann.closeLine } : {}),
      // points refs carry the arc `type` flags (parallel to basePoints) so
      // pasteAnnotationService preserves them on the placed annotation.
      points: ann.points.map((p) => (p.type ? { type: p.type } : {})),
    };

    const item = { annotation, basePoints };

    // STRIP ghost needs the band width (target px) + orientation.
    if (ann.type === "STRIP") {
      item.stripWidthPx = computeStripWidthPx(style, mbpxTarget);
      item.stripOrientation = style.stripOrientation ?? 1;
    }

    items.push(item);
  }

  // 3. Group source center = bbox center of all basePoints
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
    templateRecords,
    clipboard: { sourceCenter, items },
    scaled,
  };
}
