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

// Summarize the project templates for the model (label/type/colors only).
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
    }));
}

/**
 * Publish the main baseMap to the relay: downscaled JPEG + the metadata the
 * model and the import need (reference size, scale, templates).
 *
 * Phase 1 guard: the active version must have an identity transform, else
 * normalized coordinates of the displayed image would not map onto the
 * reference frame used by the import.
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
  });
}
