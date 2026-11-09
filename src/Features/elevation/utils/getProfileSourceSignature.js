// Signature of a profile SOURCE drawing (an annotation flagged `isProfile`)
// as applyProfileFromAnnotationService reads it: everything that changes the
// generated profile line — vertices (position, arc control / base point
// flags, order), closure, hidden segments and the source base map's frame /
// scale. Stored on the generated line (`sourceSignature`) so the source sync
// (useProfileLinesSourceSync) re-applies the line only when the source
// actually changed, and never loops on its own writes.
//
// Inputs: the source row, its point rows (db.points, aligned on
// `src.points`) and its base map row. Returns a string, or null when the
// source cannot be read (missing / soft-deleted / no frame).
const num = (v) => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : "");

export default function getProfileSourceSignature({
  src,
  srcRows,
  srcBaseMap,
}) {
  if (!src || src.deletedAt) return null;
  const imageSize = srcBaseMap?.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return null;
  const refs = src.points ?? [];
  const rows = srcRows ?? [];
  const pts = refs
    .map((ref, i) => {
      const p = rows[i];
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
      return `${num(p.x)},${num(p.y)},${ref?.type === "circle" ? "c" : "s"}${
        ref?.isBasePoint ? "*" : ""
      }`;
    })
    .filter(Boolean);
  const hidden = [
    ...(src.hiddenSegmentsIdx ?? []),
    ...(src.hiddenSegmentsPointIds ?? []).map((pair) =>
      Array.isArray(pair) ? pair.join(">") : String(pair)
    ),
  ];
  return [
    `v1`,
    `pts:${pts.join(";")}`,
    `closed:${src.closeLine ? 1 : 0}`,
    `hidden:${hidden.join(";")}`,
    `frame:${num(imageSize.width)}x${num(imageSize.height)}@${num(
      srcBaseMap?.meterByPx
    )}`,
  ].join("|");
}
