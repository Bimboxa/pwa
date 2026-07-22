// Characters accepted in the typed extrusion buffer. Mirrors the 2D drawing
// constraint buffer (digits + decimal separator), plus a leading minus so a
// face can be pulled back down.
export const EXTRUDE_BUFFER_CHAR_RE = /^[0-9.,-]$/;

// The typed buffer as a number, or null while it holds nothing usable yet
// ("", "-", "2." …) — the caller then falls back to the mouse-derived value.
export default function parseExtrudeValueBuffer(buffer) {
  if (!buffer) return null;
  const parsed = parseFloat(buffer.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
