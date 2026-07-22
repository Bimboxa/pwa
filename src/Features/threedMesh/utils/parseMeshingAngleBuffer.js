// Typed angle buffer of the angular cut tool (degrees). Mirrors
// parseExtrudeValueBuffer: no sign here — the side the angle opens to comes
// from the mouse, only its magnitude is typed.

export const MESHING_ANGLE_BUFFER_CHAR_RE = /^[0-9.,]$/;

export default function parseMeshingAngleBuffer(buffer) {
  if (!buffer) return null;
  const value = parseFloat(buffer.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0 || value >= 180) return null;
  return value;
}
