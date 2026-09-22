// One temporary drawing capture per editor tab. Samples never reach Dexie.
let pending = null;
export function requestAiTaskExample(id, baseMapId, onComplete) {
  pending = { id, baseMapId, onComplete };
}
export function cancelAiTaskExample(id) {
  if (pending?.id === id) pending = null;
}
export function completeAiTaskExample({
  id,
  baseMapId,
  points,
  size,
  closeLine,
  type,
  previewStyle,
}) {
  const capture = pending;
  if (!capture || capture.id !== id) return;
  pending = null;
  if (
    baseMapId !== capture.baseMapId ||
    !size?.width ||
    !size?.height ||
    points.length < 2 ||
    points.length > 500
  ) {
    capture.onComplete(
      null,
      "L’exemple doit être dessiné sur le fond source, avec 2 à 500 points."
    );
    return;
  }
  const normalized = points.map((p) => ({
    x: p.x / size.width,
    y: p.y / size.height,
  }));
  if (
    normalized.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.y < 0 ||
        p.x > 1 ||
        p.y > 1
    )
  ) {
    capture.onComplete(
      null,
      "Dessinez l’exemple à l’intérieur du fond de plan."
    );
    return;
  }
  capture.onComplete({
    type: type === "STRIP" ? "STRIP" : "POLYLINE",
    closeLine: Boolean(closeLine),
    points: normalized,
    // Local rendering only; toAiTaskContract excludes this style from the prompt.
    previewStyle: previewStyle ? { ...previewStyle } : undefined,
  });
}
