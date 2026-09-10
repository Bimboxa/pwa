import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";

// Normalizes the "annotations dump" produced by the 🐛 "Copy annotations data"
// button of the multi-selection toolbar (ToolbarEditAnnotations) into the
// internal shape already consumed by buildImportData / ImportAnnotationsPreview.
//
// Dump shape (annotations are the HYDRATED rows out of useAnnotationsV2):
//   { imageSize: {width, height}, meterByPx, annotations: [ <resolved row> ] }
//
// Three things differ from the "inline JSON" format and are reconciled here:
//   1. points are in PIXELS (vs the image) → divided by imageSize
//   2. there is no root `annotationTemplates` array → one is synthesized from
//      the per-annotation `annotationTemplateProps` (which getAnnotationTemplateProps
//      builds as a complete projection of the template row)
//   3. point ids are SHARED across annotations (welded wall junctions) → carried
//      as `sourceId` so pasteAnnotationService mints one db.points row per
//      distinct source id instead of one per occurrence.

// Both lists mirror exactly what pasteAnnotationService can clone (see its
// type switch): claiming more would silently drop the extra types at write
// time. Anything else lands in `skipped` and is reported in the panel.

// Annotation types whose geometry lives in `points` (+ optional `cuts` holes).
const POINTS_FAMILY = ["POLYLINE", "POLYGON", "STRIP", "COTE", "RULER"];

// Annotation types whose geometry is a single `point`.
const POINT_FAMILY = ["POINT", "MARKER", "DETAIL"];

// Fields never carried onto the imported annotation row. Everything else in the
// dumped row is kept verbatim — that is what preserves `height`, `color3D`,
// `opacity3D`, `material3d`, `isExt`, `hiddenInLegend`, `offsetZ`, `overrideFields`
// and any future field, which the inline-JSON allowlist silently drops.
const SCRUBBED_FIELDS = new Set([
  // hydrated geometry — rebuilt from the normalized points below
  "points",
  "cuts",
  "point",
  "targetPoint",
  "innerPoints",
  "labelPoint",
  "rotationCenter",
  "bbox",
  // out of scope: their refs use the `pointId` key, not `id`
  "guideLines",
  "isoHeightLines",
  "profileLines",
  // render-time only — useAnnotationsV2 recomputes them, they must not be persisted
  "annotationTemplateProps",
  "annotationTemplate",
  "annotationLabel",
  "templateLabel",
  "baseMapName",
  "listingName",
  "isForBaseMaps",
  "qties",
  "corruptedPointIds",
  "imageSize",
  // identity / audit / links — re-derived at write time
  "id",
  "projectId",
  "listingId",
  "baseMapId",
  "annotationTemplateId",
  "drawingShape",
  "createdAt",
  "updatedAt",
  "createdBy",
  "createdByUserIdMaster",
  "updatedByUserIdMaster",
  "deletedAt",
  "deletedByUserIdMaster",
  "entityId",
  "layerId",
]);

function pickProps(annotation) {
  const out = {};
  for (const [key, value] of Object.entries(annotation)) {
    if (SCRUBBED_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  // The row's own label. useAnnotationsV2 moves it to `annotationLabel` whenever
  // `label` was replaced (entity / template override), so annotationLabel wins.
  const label = annotation.annotationLabel ?? annotation.label;
  if (label !== undefined && label !== null) out.label = label;
  return out;
}

// px (vs the source image) → [0..1], carrying the id as `sourceId` and the
// inline ref flags. `type` / offsets are only carried when they differ from the
// read-time defaults resolvePoints applies ("square" / 0 / 0), so the dumped
// defaults do not bloat every ref.
function normalizePoint(point, width, height) {
  if (!point) return null;
  const x = point.x / width;
  const y = point.y / height;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const out = { x, y };
  if (point.id) out.sourceId = point.id;
  if (point.type === "circle") out.type = "circle";
  if (point.offsetTop) out.offsetTop = point.offsetTop;
  if (point.offsetBottom) out.offsetBottom = point.offsetBottom;
  return out;
}

function normalizePoints(points, width, height) {
  if (!Array.isArray(points)) return [];
  return points.map((p) => normalizePoint(p, width, height)).filter(Boolean);
}

/**
 * @param {Object} json - the raw dump { imageSize, meterByPx, annotations }
 * @returns {{
 *   kind: "DUMP", image: {width, height, widthMeters?}, sourceListingId: ?string,
 *   annotationTemplates: Object[], annotations: Object[], skipped: {id, type, reason}[]
 * }}
 */
export default function normalizeAnnotationsDumpJson(json) {
  const { width, height } = json.imageSize;
  const meterByPx = json.meterByPx;

  const image = { width, height };
  // The panel's real-scale mode asks for the image width in meters; the dump
  // already carries the scale, so derive it rather than asking the user.
  if (meterByPx > 0) image.widthMeters = meterByPx * width;

  const templatesById = new Map();
  const annotations = [];
  const skipped = [];
  let sourceListingId = null;

  for (const ann of json.annotations) {
    const type = ann?.type;
    const isPointsFamily = POINTS_FAMILY.includes(type);
    const isPointFamily = POINT_FAMILY.includes(type);

    if (!isPointsFamily && !isPointFamily) {
      skipped.push({ id: ann?.id, type, reason: "type non supporté" });
      continue;
    }

    const normalized = {
      // Kept as-is: pasteAnnotationService mints a fresh id at write time but
      // uses this one to look up the source's relAnnotationMappingCategory rows.
      id: ann.id,
      type,
      annotationTemplateId: ann.annotationTemplateId,
      props: pickProps(ann),
    };

    if (isPointsFamily) {
      const points = normalizePoints(ann.points, width, height);
      if (points.length < 2) {
        skipped.push({ id: ann.id, type, reason: "moins de 2 points" });
        continue;
      }
      normalized.points = points;

      const cuts = (ann.cuts ?? [])
        .map((cut) => ({ points: normalizePoints(cut?.points, width, height) }))
        .filter((cut) => cut.points.length >= 3);
      if (cuts.length) normalized.cuts = cuts;
    } else {
      const point = normalizePoint(ann.point, width, height);
      if (!point) {
        skipped.push({ id: ann.id, type, reason: "point manquant" });
        continue;
      }
      normalized.point = point;
    }

    annotations.push(normalized);
    if (!sourceListingId && ann.listingId) sourceListingId = ann.listingId;

    // Synthesize the template from the first annotation carrying it.
    const templateId = ann.annotationTemplateId;
    if (templateId && !templatesById.has(templateId)) {
      const props = ann.annotationTemplateProps;
      const templateType = props?.type ?? type;
      templatesById.set(templateId, {
        ...(props ?? {}),
        id: templateId,
        type: templateType,
        // getAnnotationTemplateProps does not project drawingShape — take the
        // annotation's own, which useAnnotationsV2 leaves untouched.
        drawingShape:
          ann.drawingShape ?? resolveDrawingShapeFromType(templateType),
        label: props?.label ?? ann.annotationLabel ?? ann.label ?? templateType,
        // No annotationTemplateProps in the dump (deleted template, base-map
        // annotation, ...): the row can only be reused, not faithfully recreated.
        ...(props ? {} : { incomplete: true }),
      });
    }
  }

  return {
    kind: "DUMP",
    image,
    meterByPx,
    sourceListingId,
    annotationTemplates: [...templatesById.values()],
    annotations,
    skipped,
  };
}
