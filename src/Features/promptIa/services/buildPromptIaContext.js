import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
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

// Template of the detail bubbles ("pastilles") of a carnet de détails: copied
// as-is by the model, like REVIEW_TEMPLATE. Colour = the app's secondary.
export const DETAIL_TEMPLATE = {
  id: "tpl_detail",
  label: "Détail",
  type: "DETAIL",
  fillColor: "#e85426",
  hiddenInLegend: true,
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
  // 3D defaults (metres): extrusion height, lift above the plan
  "height",
  "offsetZ",
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
  // Preset bubble templates only carry `drawingShape`: the output contract
  // is keyed on `type`.
  if (!out.type && t.drawingShape === "DETAIL") out.type = "DETAIL";
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

// Detail baseMaps the project already has: the model links them by id
// instead of creating the same page twice. `attachmentId` is set when the
// source PDF is one of the zip's attachments.
export function summarizeDetailBaseMaps(detailBaseMaps, attachments) {
  const attached = attachments ?? [];
  return (detailBaseMaps ?? []).map((bm) => {
    const from = bm.createdFrom ?? {};
    const attachment =
      attached.find((a) => a.id === from.resourceId) ??
      attached.find((a) => a.name === from.pdfFileName);
    return {
      id: bm.id,
      name: bm.name ?? null,
      detailRef: bm.detailRef ?? null,
      source: {
        attachmentId: attachment?.id ?? null,
        pdfFileName: from.pdfFileName ?? null,
        pageNumber: from.pageNumber ?? null,
        rotation: from.rotation ?? 0,
        bboxInRatio: from.bboxInRatio ?? null,
      },
    };
  });
}

// `plan.heightMap` of contexte.json: how to read `hauteurs.png` (RG16, see
// utils/heightMapRg16) and what its values mean for the 3D fields.
export function summarizeHeightMap(heightMap, baseMap) {
  const planeAltitude = getBaseMapTransform(baseMap)?.position?.y ?? 0;
  return {
    file: heightMap.file,
    previewFile: heightMap.previewFile,
    width: heightMap.width,
    height: heightMap.height,
    encoding: "RG16",
    formula: "v = R * 256 + G ; h = (v - 1) / 65534 * zMax",
    noData: [0, 0],
    unit: "m",
    zMin: 0,
    zMax: heightMap.zMax,
    reference:
      "hauteur au-dessus du plan du fond : le repère de offsetZ (le plan = 0)",
    planeAltitude: Math.round(planeAltitude * 1000) / 1000,
    cellSizeM: heightMap.cellSizeM,
    coverage: heightMap.coverage,
  };
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
 * @param {{fromTemplates:boolean, free:boolean, details:boolean, description:string}} p.mode
 * @param {Object[]} [p.attachments] - files of the zip: {id, name, file,
 *   mime, byteSize, pageCount, pages}
 * @param {Object[]} [p.detailBaseMaps] - raw detail baseMap records of the
 *   project (useDetailBaseMaps), offered for reuse
 * @param {Object|null} [p.heightMap] - height map picture of a scan base map
 *   (buildPromptIaHeightMapImages): {file, previewFile, width, height, zMax,
 *   coverage, cellSizeM}
 */
export default function buildPromptIaContext({
  baseMap,
  image,
  source,
  listing,
  templates,
  annotations,
  mode,
  attachments = [],
  detailBaseMaps = [],
  heightMap = null,
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
      details: Boolean(mode.details),
      description: mode.description ?? "",
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
      // Scan base map: heights above the plan, pixel for pixel with plan.png
      heightMap: heightMap ? summarizeHeightMap(heightMap, baseMap) : null,
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
    attachments: attachments.map((a) => ({
      id: a.id,
      name: a.name,
      file: a.file,
      mime: a.mime ?? null,
      byteSize: a.byteSize ?? null,
      pageCount: a.pageCount ?? null,
      pages: a.pages ?? [],
    })),
    detailTemplate: DETAIL_TEMPLATE,
    existingDetailBaseMaps: summarizeDetailBaseMaps(
      detailBaseMaps,
      attachments
    ),
    output: {
      coordinateSpaces: ["image", "pdf_user_space"],
      // 3D fields accepted on the annotations (metres above the plan)
      annotationFields3d: [
        "offsetZ",
        "height",
        "points[].offsetTop",
        "points[].offsetBottom",
        "guideLines[].slopePct",
      ],
      rootKeys: [
        "version",
        "coordinateSpace",
        "note",
        "image",
        "annotationTemplates",
        "annotations",
        "baseMaps",
      ],
      singleLine: true,
    },
  };
}
