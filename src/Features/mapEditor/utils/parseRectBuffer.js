// Typed metric buffer ("1.25", "-0,8", "3") → number, or null while the
// buffer is empty or only a sign / separator. Shared by the rectangle X / Y
// dims (RectangleDimsBottomBar, DrawingMetricsContext, the 3D "Coupe face"
// rectangle) and the face cut distance buffer.
export default function parseRectBuffer(buf) {
  if (!buf) return null;
  const normalized = buf.replace(",", ".");
  if (normalized === "-" || normalized === "." || normalized === "-.")
    return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
