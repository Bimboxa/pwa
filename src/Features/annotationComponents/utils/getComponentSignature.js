// Signature of everything the children of a component are derived from: the
// point refs of the source (ids + arc flags — NOT the coordinates, the points
// are shared), its closure / band side / layer / base map, and the enabled
// items with the version of their template. Stored on the source
// (`componentApplied.signature`) by applyComponentService so the sync
// (useComponentsSync) regenerates only when something actually changed.
//
// `items` = getComponentItems(...) of the source.
export function getPointRefsKey(refs) {
  return (refs ?? [])
    .map(
      (ref) =>
        `${ref?.id ?? ""}${ref?.type === "circle" ? "c" : ""}:${
          ref?.offsetTop ?? ""
        }:${ref?.offsetBottom ?? ""}`
    )
    .join(";");
}

export default function getComponentSignature({ source, items }) {
  if (!source || source.deletedAt) return null;
  const itemsKey = (items ?? [])
    .filter((item) => item.enabled)
    .map(
      (item) =>
        `${item.annotationTemplateId}:${item.type}@${
          item.template?.updatedAt ?? ""
        }`
    )
    .join(",");
  return [
    "v1",
    `pts:${getPointRefsKey(source.points)}`,
    `closed:${source.closeLine ? 1 : 0}`,
    `strip:${source.type === "STRIP" ? 1 : 0}:${source.stripOrientation ?? ""}`,
    `layer:${source.layerId ?? ""}`,
    `baseMap:${source.baseMapId ?? ""}`,
    `items:${itemsKey}`,
  ].join("|");
}
