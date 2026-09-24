import buildBaseMapSnapshotImage from "./buildBaseMapSnapshotImage";
import { publishBaseMapSnapshot } from "./assistantRelayClient";

// Summarize the project templates for the model: label/type/colors, plus
// what it needs to pick one when drawing live (shape, band width, height).
// `description` (template.description) is NOT sent yet: the relay's
// TemplateSummary schema is strict and would reject the payload. Add it to the
// relay first, then include it here.
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
 * The picture is built in the reference frame (see
 * buildBaseMapSnapshotImage), so any active version can be published.
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
  const context = buildBaseMapContext({
    baseMap,
    projectId,
    scopeId,
    listingId,
    templates,
    config,
  });
  const image = await buildBaseMapSnapshotImage({
    baseMap,
    maxLongEdge: config?.maxImageLongEdge ?? 1600,
    jpegQuality: config?.jpegQuality ?? 0.8,
  });
  const provenance = relayProvenance(baseMap, config);

  return publishBaseMapSnapshot({
    ...context,
    image,
    ...(provenance.baseMapJobId
      ? { baseMapJobId: provenance.baseMapJobId }
      : {}),
  });
}

/**
 * Everything the relay needs about a base map EXCEPT its picture: what the
 * in-app chat sends with every message (the picture is uploaded only when
 * the model asks to see the plan). `imageKey` changes when the image does,
 * so the relay never receives the same picture twice.
 */
export function buildBaseMapContext({
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
  const refWidth = Math.round(refSize.width);
  const refHeight = Math.round(refSize.height);
  const meterByPx = baseMap.getMeterByPx?.() ?? baseMap.meterByPx ?? null;
  // The published picture depends on the active version AND on how it sits
  // in the reference frame: both are part of the key.
  const version = baseMap.getActiveVersion?.();
  const t = baseMap.getActiveVersionTransform?.() ?? {};
  const imageFile =
    version?.image?.fileName ?? baseMap.image?.fileName ?? "image";
  const placement = [t.x ?? 0, t.y ?? 0, t.scale ?? 1, t.rotation ?? 0]
    .map((n) => Math.round(Number(n) * 1000) / 1000)
    .join(",");
  const provenance = relayProvenance(baseMap, config);
  // The job id belongs to the full publication only (it triggers the
  // annotations job of a vectorization run).
  delete provenance.baseMapJobId;

  return {
    baseMapId: baseMap.id,
    projectId: projectId ?? null,
    scopeId: scopeId ?? null,
    listingId: listingId ?? null,
    name: baseMap.name ?? null,
    refWidth,
    refHeight,
    meterByPx: meterByPx > 0 ? meterByPx : null,
    templates: summarizeTemplates(templates),
    imageKey:
      `${baseMap.id}:${imageFile}:${refWidth}x${refHeight}:${placement}`.slice(
        0,
        200
      ),
    ...provenance,
  };
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
