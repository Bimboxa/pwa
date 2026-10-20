// 35 mm-equivalent focal <-> pixels. The "36 mm" of the equivalent frame is
// its LONG side, so the conversion uses max(W, H) — a portrait photo keeps
// the same focal in px as its landscape twin (using the width alone would
// under-estimate a portrait focal by the aspect ratio).

export const DEFAULT_FOCAL_35 = 26; // typical phone wide lens

export function focal35ToPx(focal35, imageSize) {
  const s = Math.max(imageSize?.width ?? 0, imageSize?.height ?? 0);
  if (!(Number.isFinite(focal35) && focal35 > 0 && s > 0)) return null;
  return (focal35 * s) / 36;
}

export function pxToFocal35(focalPx, imageSize) {
  const s = Math.max(imageSize?.width ?? 0, imageSize?.height ?? 0);
  if (!(Number.isFinite(focalPx) && focalPx > 0 && s > 0)) return null;
  return (focalPx * 36) / s;
}
