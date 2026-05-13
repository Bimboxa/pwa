/**
 * Apply the paste-ghost transform (flipX → rotation → translation) to a set of
 * points in pixel space.
 *
 * The transform is built around `sourceCenter` (the bbox-center of the
 * annotation at the moment of Ctrl+C). After flip + rotation around that
 * center, the result is translated so that the transformed center lands on
 * `targetCenter`.
 *
 * Rotation by a multiple of 90° around the center is mathematically
 * equivalent before vs. after the translation, so this single pass covers
 * "ghost follows cursor at any rotation/flip".
 *
 * @param {Array<{x:number,y:number}>} points
 * @param {{x:number,y:number}} sourceCenter
 * @param {{x:number,y:number}} targetCenter
 * @param {{ rotationDeg: number, flipX: boolean }} transform
 * @returns {Array<{x:number,y:number}>}
 */
export default function applyPasteTransformToPoints(
  points,
  sourceCenter,
  targetCenter,
  transform,
) {
  if (!points?.length) return [];

  const { rotationDeg = 0, flipX = false } = transform ?? {};
  const angleRad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return points.map((p) => {
    let dx = p.x - sourceCenter.x;
    let dy = p.y - sourceCenter.y;

    if (flipX) dx = -dx;

    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;

    return { ...p, x: targetCenter.x + rx, y: targetCenter.y + ry };
  });
}
