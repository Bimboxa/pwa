import buildBaseMapSnapshotImage from "./buildBaseMapSnapshotImage";
import { publishBaseMapSnapshot } from "./assistantRelayClient";

function isIdentityTransform(t) {
  if (!t) return true;
  return (
    (t.x ?? 0) === 0 &&
    (t.y ?? 0) === 0 &&
    (t.rotation ?? 0) === 0 &&
    (t.scale ?? 1) === 1
  );
}

// Summarize the project templates for the model: label/type/colors, plus
// what it needs to pick one when drawing live (shape, band width, height).
function summarizeTemplates(templates) {
  return (templates ?? [])
    .filter((t) => t?.id)
    .slice(0, 500)
    .map((t) => ({
      id: t.id,
      ...(t.label ? { label: t.label } : {}),
      ...(t.type ? { type: t.type } : {}),
      ...(t.fillColor ? { fillColor: t.fillColor } : {}),
      ...(t.strokeColor ? { strokeColor: t.strokeColor } : {}),
      ...(t.drawingShape ? { drawingShape: t.drawingShape } : {}),
      ...(typeof t.strokeWidth === "number"
        ? { strokeWidth: t.strokeWidth }
        : {}),
      ...(t.strokeWidthUnit ? { strokeWidthUnit: t.strokeWidthUnit } : {}),
      ...(typeof t.height === "number" ? { height: t.height } : {}),
    }));
}

/**
 * Publish the main baseMap to the relay: downscaled JPEG + the metadata the
 * model and the import need (reference size, scale, templates).
 *
 * Phase 1 guard: the active version must have an identity transform, else
 * normalized coordinates of the displayed image would not map onto the
 * reference frame used by the import.
 *
 * Provenance: when the base map was cut out of a PDF stored on the relay
 * (created from a ChatGPT base map job), `createdFrom.relay` carries the
 * sourcePdfId / baseMapJobId and `createdFrom` the page/rotation/crop; both
 * are published so the model can submit annotations in PDF user space.
 */
export default async function publishBaseMapSnapshotService({
  baseMap,
  projectId,
  scopeId,
  listingId,
  templates,
  config,
}) {
  if (!baseMap?.id) throw new Error("Aucun fond de plan sélectionné.");

  const refSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
  if (!refSize?.width || !refSize?.height) {
    throw new Error("Dimensions du fond de plan inconnues.");
  }
  if (!isIdentityTransform(baseMap.getActiveVersionTransform?.())) {
    throw new Error(
      "La version active du fond est transformée (décalage/rotation/échelle) : publication non supportée."
    );
  }

  const image = await buildBaseMapSnapshotImage({
    baseMap,
    maxLongEdge: config?.maxImageLongEdge ?? 1600,
    jpegQuality: config?.jpegQuality ?? 0.8,
  });

  const meterByPx = baseMap.getMeterByPx?.() ?? baseMap.meterByPx ?? null;
  const provenance = relayProvenance(baseMap, config);

  return publishBaseMapSnapshot({
    baseMapId: baseMap.id,
    projectId: projectId ?? null,
    scopeId: scopeId ?? null,
    listingId: listingId ?? null,
    name: baseMap.name ?? null,
    refWidth: Math.round(refSize.width),
    refHeight: Math.round(refSize.height),
    meterByPx: meterByPx > 0 ? meterByPx : null,
    templates: summarizeTemplates(templates),
    image,
    ...provenance,
  });
}

function relayProvenance(baseMap, config) {
  const cf = baseMap?.createdFrom;
  const relay = cf?.relay;
  if (cf?.type !== "PDF_PAGE" || !relay?.sourcePdfId) return {};
  // Only meaningful on the relay the PDF lives on.
  const sameRelay =
    !relay.relayBaseUrl ||
    !config?.relayBaseUrl ||
    relay.relayBaseUrl.replace(/\/+$/, "") ===
      config.relayBaseUrl.replace(/\/+$/, "");
  if (!sameRelay) return {};
  const rotation = Number(cf.rotation ?? 0);
  return {
    sourcePdfId: relay.sourcePdfId,
    sourceFrame: {
      pageNumber: Number(cf.pageNumber ?? 1),
      rotation: [0, 90, 180, 270].includes(rotation) ? rotation : 0,
      bboxInRatio: cf.bboxInRatio ?? { x1: 0, y1: 0, x2: 1, y2: 1 },
      dpi: cf.dpi != null ? Math.round(Number(cf.dpi)) : null,
      blueprintScale: cf.blueprintScale ? String(cf.blueprintScale) : null,
    },
    ...(relay.baseMapJobId ? { baseMapJobId: relay.baseMapJobId } : {}),
  };
}
