import { nanoid } from "@reduxjs/toolkit";

// Pure conversions of Krnet plan/shape rows (node-replayable, no Dexie).

const clamp01 = (v) => Math.min(Math.max(Number(v) || 0, 0), 1);

export const SHAPE_TYPES = ["POLYLINE", "POLYGON"];
export const MIN_POINTS = { POLYLINE: 2, POLYGON: 3 };

// Style keys copied from a Bimboxa annotationTemplate onto the shape row.
const TEMPLATE_STYLE_KEYS = [
  "fillColor",
  "fillOpacity",
  "fillType",
  "strokeColor",
  "strokeWidth",
  "strokeWidthUnit",
  "strokeOpacity",
  "strokeType",
];

export function isShapeType(type) {
  return SHAPE_TYPES.includes(type);
}

// Krnet `settings.scale.meterByPx` is metres per px of `scale.imageWidth`;
// Bimboxa's is per px of the local image — same file in practice, rescaled
// when both widths are known. null when Krnet has no calibration.
export function getNotesAppMeterByPx(scale, localImageWidth) {
  const value = Number(scale?.meterByPx);
  if (!(value > 0)) return null;
  const remoteWidth = Number(scale?.imageWidth);
  if (remoteWidth > 0 && Number(localImageWidth) > 0) {
    return (value * remoteWidth) / Number(localImageWidth);
  }
  return value;
}

// Krnet `points` column: parsed [{x,y}] (normalizeNotesAppRow) or a raw JSON
// string when parsing was skipped. Returns [] on garbage.
export function parseNotesAppShapePoints(raw) {
  let points = raw;
  if (typeof points === "string") {
    try {
      points = JSON.parse(points);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(points)) return [];
  return points
    .filter(
      (p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y))
    )
    .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
}

// One Krnet POLYLINE / POLYGON row -> Bimboxa annotation row + FRESH
// db.points rows (normalized coordinates copied verbatim). Returns null when
// the shape is degenerate (type unknown or too few finite points): the
// caller counts it as skipped. `base` = the local row when updating (its
// bookkeeping fields are kept; geometry, style and label are replaced).
export function mapNotesAppShapeToAnnotation({
  remote,
  base,
  template,
  label,
  listingId,
  baseMapId,
  projectId,
  scopeId,
  userIdMaster,
  updatedAtIso,
  nowIso,
}) {
  const type = remote?.type;
  if (!isShapeType(type)) return null;
  const coords = parseNotesAppShapePoints(remote.points);
  if (coords.length < MIN_POINTS[type]) return null;

  const annotationId = base?.id ?? nanoid();
  const pointRows = coords.map((c) => ({
    id: nanoid(),
    x: c.x,
    y: c.y,
    baseMapId,
    projectId,
    listingId,
    scopeId,
    forMarker: false,
  }));

  const style = {};
  for (const key of TEMPLATE_STYLE_KEYS) {
    if (template?.[key] != null) style[key] = template[key];
  }

  const row = {
    ...(base ?? {}),
    id: annotationId,
    idMaster: remote.id,
    remoteSource: "notesApp",
    remoteUpdatedAt: remote.updatedAt ?? null,
    type,
    drawingShape: type,
    closeLine: type === "POLYGON" ? true : Boolean(remote.closeLine),
    points: pointRows.map((p) => ({ id: p.id })),
    ...(type === "POLYGON" && { cuts: [] }),
    annotationTemplateId: template?.id ?? base?.annotationTemplateId ?? null,
    listingId,
    baseMapId,
    projectId,
    label: label ?? "",
    showLabel: true,
    ...style,
    createdAt:
      base?.createdAt ??
      (remote.createdAt
        ? new Date(remote.createdAt).toISOString()
        : (updatedAtIso ?? nowIso)),
    updatedAt: updatedAtIso ?? nowIso,
    createdByUserIdMaster: base?.createdByUserIdMaster ?? userIdMaster,
  };
  delete row.deletedAt; // resurrected remotely

  return { row, pointRows };
}
