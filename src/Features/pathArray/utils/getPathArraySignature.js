// Signature of everything a path array (« Calepinage » of a POLYLINE,
// `annotation.pathArray`) is generated from: the source geometry (vertices,
// arc flags, closure, altitude, layer), its settings (step, template), the
// template itself and the base map frame / scale. Stored on the source
// (`pathArray.appliedSignature`) by applyPathArrayService so the sync
// (usePathArraySync) regenerates the children only when something actually
// changed, and never loops on its own writes.
//
// Inputs: the source row, its point rows (db.points, aligned on
// `source.points`), its base map row and the template row. Returns a string,
// or null when the source carries no usable path array.
const num = (v) => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : "");

export function hasPathArray(annotation) {
  const config = annotation?.pathArray;
  return (
    Boolean(annotation) &&
    !annotation.deletedAt &&
    annotation.type === "POLYLINE" &&
    Boolean(config?.annotationTemplateId) &&
    Number(config?.step) > 0
  );
}

export default function getPathArraySignature({
  source,
  pointRows,
  baseMap,
  template,
}) {
  if (!hasPathArray(source)) return null;
  const refs = source.points ?? [];
  const rows = pointRows ?? [];
  const pts = refs.map((ref, i) => {
    const p = rows[i];
    return `${num(p?.x)},${num(p?.y)},${ref?.type === "circle" ? "c" : "s"}`;
  });
  const templateLive = template && !template.deletedAt;
  return [
    `v1`,
    `pts:${pts.join(";")}`,
    `closed:${source.closeLine ? 1 : 0}`,
    `z:${num(Number(source.offsetZ))}`,
    `layer:${source.layerId ?? ""}`,
    `step:${num(Number(source.pathArray.step))}`,
    `tpl:${source.pathArray.annotationTemplateId}@${
      templateLive
        ? `${template.updatedAt ?? ""}#${template.object3D?.fileName ?? ""}`
        : "gone"
    }`,
    `frame:${num(baseMap?.refWidth ?? baseMap?.image?.imageSize?.width)}x${num(
      baseMap?.refHeight ?? baseMap?.image?.imageSize?.height
    )}@${num(baseMap?.meterByPx)}`,
  ].join("|");
}
