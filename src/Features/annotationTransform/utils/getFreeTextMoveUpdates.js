// New STORED geometry of FREE_TEXT annotations after a translation: the
// inline targetPoint / labelPoint (and the optional elbowPoint), normalized
// to [0..1] vs imageSize — the storage model of the LABEL family (see
// useAnnotationsV2, which resolves them to pixels). Same formula as the
// whole-move commit of MainMapEditorV3 (handleAnnotationMoveCommit).
//
// annotations: FREE_TEXT annotations resolved in PIXELS; the others are
// ignored. Returns Map annotationId → { targetPoint, labelPoint, elbowPoint? }.
export default function getFreeTextMoveUpdates({
  annotations,
  deltaPx,
  imageSize,
}) {
  const updates = new Map();
  const width = imageSize?.width;
  const height = imageSize?.height;
  if (!deltaPx || !(width > 0) || !(height > 0)) return updates;

  const normalize = (pt) => ({
    x: (pt.x + deltaPx.x) / width,
    y: (pt.y + deltaPx.y) / height,
  });
  const isPoint = (pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y);

  for (const ann of annotations ?? []) {
    if (ann?.type !== "FREE_TEXT") continue;
    // A row without its 2-point geometry is resolved at the image centre by
    // useAnnotationsV2; both points are always present here.
    const targetPoint = isPoint(ann.targetPoint)
      ? ann.targetPoint
      : ann.labelPoint;
    const labelPoint = isPoint(ann.labelPoint) ? ann.labelPoint : targetPoint;
    if (!isPoint(targetPoint) || !isPoint(labelPoint)) continue;
    const update = {
      targetPoint: normalize(targetPoint),
      labelPoint: normalize(labelPoint),
    };
    if (isPoint(ann.elbowPoint)) update.elbowPoint = normalize(ann.elbowPoint);
    updates.set(ann.id, update);
  }
  return updates;
}
