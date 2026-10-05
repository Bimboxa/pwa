// Angle helpers of the 2D « Tourner » tool. Pixel space is y-down: a positive
// PIXEL angle turns clockwise on screen. The user-facing angle (typed buffer,
// cursor label) is counter-clockwise positive — same convention as the 3D
// tool — hence the sign flips.

export const ROTATE_SHIFT_STEP_DEG = 15;

// Signed pixel-space angle (deg, in ]-180, 180]) from the pivot→reference
// direction to the pivot→cursor direction. null when a direction is
// degenerate.
export function getRotatePixelAngleDeg({ pivot, reference, cursor, stepDeg }) {
  const rx = reference.x - pivot.x;
  const ry = reference.y - pivot.y;
  const cx = cursor.x - pivot.x;
  const cy = cursor.y - pivot.y;
  if (Math.hypot(rx, ry) < 1e-9 || Math.hypot(cx, cy) < 1e-9) return null;
  let deg = ((Math.atan2(cy, cx) - Math.atan2(ry, rx)) * 180) / Math.PI;
  if (stepDeg > 0) deg = Math.round(deg / stepDeg) * stepDeg;
  return normalizeAngleDeg(deg);
}

export function normalizeAngleDeg(deg) {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

// Typed buffer (user degrees, counter-clockwise positive, "," or ".") →
// pixel-space angle in degrees, or null when not parsable.
export function parseAngleBufferToPixelDeg(buffer) {
  if (!buffer) return null;
  const deg = parseFloat(String(buffer).replace(",", "."));
  if (!Number.isFinite(deg)) return null;
  return -deg;
}

// Pixel-space angle → user-facing label ("12.5°").
export function formatUserAngle(pixelDeg) {
  const user = -pixelDeg;
  const rounded = Math.round(user * 10) / 10;
  return `${Object.is(rounded, -0) ? 0 : rounded}°`;
}

// Keys accepted in the typed angle buffer; "-" only as the first character.
export function appendToAngleBuffer(buffer, key) {
  if (!/^[0-9.,-]$/.test(key)) return buffer;
  if (key === "-" && buffer !== "") return buffer;
  return buffer + key;
}
