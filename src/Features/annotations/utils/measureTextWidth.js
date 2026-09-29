// Synchronous text width measure on a shared offscreen 2D canvas.
// Returns undefined when no canvas is available (node, SSR) so the caller
// can fall back on an estimate.

const DEFAULT_FONT_FAMILY = "Roboto, Helvetica, Arial, sans-serif";

let _ctx = null;

function getContext() {
  if (_ctx) return _ctx;
  if (typeof document === "undefined") return null;
  _ctx = document.createElement("canvas").getContext("2d");
  return _ctx;
}

export default function measureTextWidth(
  text,
  fontSize,
  { fontFamily = DEFAULT_FONT_FAMILY, fontWeight = "bold" } = {}
) {
  const ctx = getContext();
  if (!ctx) return undefined;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text ?? "").width;
}
