import getSystemEffectiveSource from "./getSystemEffectiveSource";
import getSystemParams from "./getSystemParams";

// Signature of everything the generated annotations of a system instance are
// derived from: the source geometry and dimensions, the system parameters,
// the procedure version, the templates of the system listing and the base map
// frame / scale. Stored on the source (`systemApplied.signature`) by
// applySystemService so the sync (useSystemsSync) regenerates only when
// something actually changed, and never loops on its own writes.
//
// Inputs: the source row, its point rows (db.points, aligned on
// `source.points`), its base map row, the system listing row, the templates
// of that listing and the procedure (registry entry, may be missing).
const num = (v) => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : "");

export default function getSystemSignature({
  source,
  pointRows,
  baseMap,
  listing,
  templates,
  procedure,
}) {
  if (!source || source.deletedAt || !listing?.system) return null;
  const refs = source.points ?? [];
  const rows = pointRows ?? [];
  const pts = refs.map((ref, i) => {
    const p = rows[i];
    return `${num(p?.x)},${num(p?.y)},${ref?.type === "circle" ? "c" : "s"}`;
  });
  const sourceTemplate = (templates ?? []).find(
    (t) => t.id === source.annotationTemplateId
  );
  const effective = getSystemEffectiveSource(source, sourceTemplate);
  const params = getSystemParams({ source, listing, procedure });
  const templatesKey = (templates ?? [])
    .filter((t) => t && !t.deletedAt)
    .map((t) => `${t.id}:${t.systemRole ?? ""}@${t.updatedAt ?? ""}`)
    .sort()
    .join(",");
  return [
    `v1`,
    `proc:${listing.system.procedureKey ?? ""}@${
      procedure ? (procedure.version ?? 1) : "none"
    }`,
    `pts:${pts.join(";")}`,
    `closed:${source.closeLine ? 1 : 0}`,
    // band source (STRIP): its points are one edge, the side matters
    `strip:${source.type === "STRIP" ? (source.stripOrientation ?? 1) : ""}`,
    `z:${num(Number(effective.offsetZ))}`,
    `h:${num(Number(effective.height))}`,
    `w:${num(Number(effective.strokeWidth))}${effective.strokeWidthUnit ?? ""}`,
    `layer:${source.layerId ?? ""}`,
    `params:${JSON.stringify(params)}`,
    `tpl:${templatesKey}`,
    `frame:${num(baseMap?.refWidth ?? baseMap?.image?.imageSize?.width)}x${num(
      baseMap?.refHeight ?? baseMap?.image?.imageSize?.height
    )}@${num(baseMap?.meterByPx)}`,
  ].join("|");
}
