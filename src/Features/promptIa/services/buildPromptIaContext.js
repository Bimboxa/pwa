import {
  buildExistingAnnotations,
  getVisibleListingTemplates,
} from "Features/chat/utils/buildAutoDetectionContext";

// Wall junctions: the overlap the PWA "Joindre" tool and the Auto pipeline
// use when a wall end enters another wall's band (computeJoinAnnotationEnds).
export const JUNCTION_OVERLAP_CM = 1;

export const REVIEW_TEMPLATE = {
  id: "tpl_a_verifier",
  label: "À vérifier",
  type: "POLYLINE",
  strokeColor: "#e91e63",
  strokeType: "DASHED",
  strokeWidth: 20,
  strokeWidthUnit: "CM",
  groupLabel: "IA",
};

// Enough examples for the model to imitate every template without turning
// contexte.json into a dump of the plan.
const MAX_EXAMPLES = 300;
const MIN_EXAMPLES_PER_TEMPLATE = 5;

const TEMPLATE_KEYS = [
  "label",
  "type",
  "drawingShape",
  "strokeColor",
  "strokeOpacity",
  "strokeWidth",
  "strokeWidthUnit",
  "strokeType",
  "stripOrientation",
  "fillColor",
  "fillOpacity",
  "height",
  "isExt",
  "groupLabel",
  "unit",
  "decimals",
  "showUnitLabel",
  "textColor",
  "fontSize",
  "pageFormat",
  "fontWeight",
  "textAlign",
];

export function summarizeTemplateForPrompt(t) {
  const out = { id: t.id };
  for (const key of TEMPLATE_KEYS) {
    if (t[key] !== undefined && t[key] !== null && t[key] !== "")
      out[key] = t[key];
  }
  if (typeof t.description === "string" && t.description.trim())
    out.description = t.description.trim();
  return out;
}

const round4 = (v) => Math.round(v * 10000) / 10000;

function normalizeGeometry(value, refWidth, refHeight) {
  if (Array.isArray(value))
    return value.map((v) => normalizeGeometry(v, refWidth, refHeight));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "x" && typeof v === "number") out.x = round4(v / refWidth);
      else if (k === "y" && typeof v === "number")
        out.y = round4(v / refHeight);
      else out[k] = normalizeGeometry(v, refWidth, refHeight);
    }
    return out;
  }
  return value;
}

// Width of the crop in PDF points: the rotated view width times the crop
// ratio (pdfUserSpaceToImage.rotateView semantics).
function pointsPerCm(source, widthMeters) {
  const view = source?.page?.view;
  if (!widthMeters || !Array.isArray(view) || view.length !== 4) return null;
  const w = view[2] - view[0];
  const h = view[3] - view[1];
  const rotatedWidth = [90, 270].includes(source.rotation) ? h : w;
  const b = source.bboxInRatio ?? { x1: 0, x2: 1 };
  const cropWidth = (b.x2 - b.x1) * rotatedWidth;
  return cropWidth > 0 ? round4(cropWidth / (widthMeters * 100)) : null;
}

// Examples: a few per template first, then fill up to the cap.
export function pickExamples(existing, max = MAX_EXAMPLES) {
  if (existing.length <= max) return existing;
  const byTemplate = new Map();
  for (const a of existing) {
    const key = a.annotationTemplateId ?? "";
    if (!byTemplate.has(key)) byTemplate.set(key, []);
    byTemplate.get(key).push(a);
  }
  const picked = new Set();
  for (const list of byTemplate.values())
    list.slice(0, MIN_EXAMPLES_PER_TEMPLATE).forEach((a) => picked.add(a));
  for (const a of existing) {
    if (picked.size >= max) break;
    picked.add(a);
  }
  return existing.filter((a) => picked.has(a));
}

/**
 * Everything the external model needs besides the pictures: written to
 * `contexte.json` in the Prompt IA zip.
 *
 * @param {Object} p
 * @param {Object} p.baseMap - BaseMap instance (reference frame + scale)
 * @param {{width:number,height:number}} p.image - size of plan.png
 * @param {Object|null} p.source - {pageNumber, rotation, bboxInRatio, page:{view,rotate}}
 * @param {{id:string,name:string}} p.listing
 * @param {Object[]} p.templates - project annotation templates
 * @param {Object[]} p.annotations - useAnnotationsV2 rows (reference pixels)
 * @param {{fromTemplates:boolean, free:boolean, description:string}} p.mode
 */
export default function buildPromptIaContext({
  baseMap,
  image,
  source,
  listing,
  templates,
  annotations,
  mode,
}) {
  const ref = baseMap.getImageSize?.() || baseMap.image?.imageSize;
  const refWidth = Math.round(ref.width);
  const refHeight = Math.round(ref.height);
  const meterByPx = baseMap.getMeterByPx?.() ?? baseMap.meterByPx ?? null;
  const widthMeters =
    meterByPx > 0 ? Math.round(meterByPx * refWidth * 1000) / 1000 : null;

  const visible = mode.fromTemplates
    ? getVisibleListingTemplates(templates, listing?.id)
    : [];
  const visibleIds = new Set(visible.map((t) => t.id));
  const existing = mode.fromTemplates
    ? buildExistingAnnotations(
        annotations,
        listing?.id,
        baseMap.id,
        meterByPx
      ).filter((a) => visibleIds.has(a.annotationTemplateId))
    : [];
  const examples = pickExamples(existing).map((a) => ({
    id: a.id,
    annotationTemplateId: a.annotationTemplateId,
    type: a.type,
    ...(a.label ? { label: a.label } : {}),
    ...normalizeGeometry(a.geometry ?? {}, refWidth, refHeight),
  }));

  return {
    app: "Krto",
    generatedAt: new Date().toISOString(),
    mode: {
      fromTemplates: Boolean(mode.fromTemplates),
      free: Boolean(mode.free),
      description: mode.free ? mode.description ?? "" : "",
    },
    plan: {
      name: baseMap.name ?? null,
      image: { file: "plan.png", width: image.width, height: image.height },
      refSize: { width: refWidth, height: refHeight },
      widthMeters,
      meterByPx: meterByPx > 0 ? meterByPx : null,
      // pixels of plan.png per centimetre of the real plan
      pixelsPerCm: widthMeters
        ? round4(image.width / (widthMeters * 100))
        : null,
    },
    source: source
      ? {
          file: "plan.pdf",
          pageNumber: source.pageNumber,
          rotation: source.rotation,
          bboxInRatio: source.bboxInRatio,
          page: source.page,
          // PDF points per centimetre of the real plan (crop width in points
          // = plan.widthMeters)
          pointsPerCm: pointsPerCm(source, widthMeters),
        }
      : null,
    junction: { overlapCm: JUNCTION_OVERLAP_CM },
    listing: listing ? { id: listing.id, name: listing.name ?? null } : null,
    templates: visible.map(summarizeTemplateForPrompt),
    existingAnnotations: examples,
    existingAnnotationsTotal: existing.length,
    reviewTemplate: REVIEW_TEMPLATE,
    output: {
      coordinateSpaces: ["image", "pdf_user_space"],
      singleLine: true,
    },
  };
}
