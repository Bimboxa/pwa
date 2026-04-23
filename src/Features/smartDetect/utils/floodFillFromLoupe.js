/**
 * BFS 4-connected flood-fill bounded to the rotated loupe rectangle.
 *
 * Same crop convention as detectStripFromLoupe.js:
 *  - loupeBBox.x / .y / .width / .height describe the loupe as a rectangle
 *    centered on (loupeBBox.x + width/2, loupeBBox.y + height/2), with
 *    width / height being extents along the loupe's OWN rotated axes
 *    (tangent, normal), not an axis-aligned AABB.
 *  - orthoAngleRad rotates the loupe around that centre.
 *
 * Barrier tests per pixel:
 *  - full-image `luminanceMask[i] === 1` (precomputed dark pixels)
 *  - OR full-image `annotationsMask[i] === 1` (rasterized existing annotations)
 *
 * Output: { mask, offsetX, offsetY, width, height } — ROI-local Uint8Array
 * sized to the axis-aligned enclosing AABB of the rotated loupe, with
 * 1 on filled pixels. Offset is the AABB's top-left in full-image coords
 * so the traced contour can be re-translated by the caller.
 */
export default function floodFillFromLoupe({
  luminanceMask,
  annotationsMask,
  imgWidth,
  imgHeight,
  seed,
  loupeBBox,
  orthoAngleRad = 0,
}) {
  if (!luminanceMask || !loupeBBox) return null;

  const { cx, cy, halfTangent, halfNormal, tangent, normal } = getLoupeFrame(
    loupeBBox,
    orthoAngleRad
  );

  // Axis-aligned enclosing AABB of the rotated rectangle.
  const enclHalfW =
    halfTangent * Math.abs(tangent.dx) + halfNormal * Math.abs(normal.dx);
  const enclHalfH =
    halfTangent * Math.abs(tangent.dy) + halfNormal * Math.abs(normal.dy);

  const aabbX0 = Math.max(0, Math.floor(cx - enclHalfW));
  const aabbY0 = Math.max(0, Math.floor(cy - enclHalfH));
  const aabbX1 = Math.min(imgWidth - 1, Math.ceil(cx + enclHalfW));
  const aabbY1 = Math.min(imgHeight - 1, Math.ceil(cy + enclHalfH));

  const roiW = aabbX1 - aabbX0 + 1;
  const roiH = aabbY1 - aabbY0 + 1;
  if (roiW <= 0 || roiH <= 0) return null;

  // Seed in image-pixel coords, snapped to nearest free pixel inside the
  // rotated loupe if the exact cursor pixel is a barrier.
  let sx = Math.round(seed.x);
  let sy = Math.round(seed.y);
  if (!isFreeAndInsideLoupe(sx, sy)) {
    const snapped = snapSeed(sx, sy);
    if (!snapped) return null;
    sx = snapped.x;
    sy = snapped.y;
  }

  const roiMask = new Uint8Array(roiW * roiH);
  const queue = [sx, sy];
  roiMask[(sy - aabbY0) * roiW + (sx - aabbX0)] = 1;

  while (queue.length > 0) {
    const y = queue.pop();
    const x = queue.pop();

    // 4-connected neighbours
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  return {
    mask: roiMask,
    offsetX: aabbX0,
    offsetY: aabbY0,
    width: roiW,
    height: roiH,
  };

  // ---------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------

  function tryPush(px, py) {
    if (px < aabbX0 || px > aabbX1 || py < aabbY0 || py > aabbY1) return;
    const roiIdx = (py - aabbY0) * roiW + (px - aabbX0);
    if (roiMask[roiIdx] === 1) return;
    if (!isFreeAndInsideLoupe(px, py)) return;
    roiMask[roiIdx] = 1;
    queue.push(px, py);
  }

  function isFreeAndInsideLoupe(px, py) {
    if (px < 0 || px >= imgWidth || py < 0 || py >= imgHeight) return false;
    const imgIdx = py * imgWidth + px;
    if (luminanceMask[imgIdx] === 1) return false;
    if (annotationsMask && annotationsMask[imgIdx] === 1) return false;
    // Rotated-loupe containment: project onto (tangent, normal).
    const dx = px - cx;
    const dy = py - cy;
    const u = dx * tangent.dx + dy * tangent.dy;
    const v = dx * normal.dx + dy * normal.dy;
    if (Math.abs(u) > halfTangent || Math.abs(v) > halfNormal) return false;
    return true;
  }

  function snapSeed(px, py) {
    // 5x5 neighbourhood around the cursor; pick the closest free pixel.
    let best = null;
    let bestD2 = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (!isFreeAndInsideLoupe(nx, ny)) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = { x: nx, y: ny };
        }
      }
    }
    return best;
  }
}

/**
 * Build the rotated loupe orthonormal frame and centre/half-extents.
 * Mirrors detectStripFromLoupe.js:364–375: loupeBBox.width / .height are
 * extents along the rotated axes, not AABB dimensions.
 *
 * Exported so the click handler can build the same frame when it needs
 * to sanity-check seed / preview points.
 */
export function getLoupeFrame(loupeBBox, orthoAngleRad = 0) {
  const c = Math.cos(orthoAngleRad);
  const s = Math.sin(orthoAngleRad);
  const tangent = { dx: c, dy: s };
  const normal = { dx: -s, dy: c };
  const cx = loupeBBox.x + loupeBBox.width / 2;
  const cy = loupeBBox.y + loupeBBox.height / 2;
  const halfTangent = loupeBBox.width / 2;
  const halfNormal = loupeBBox.height / 2;
  return { cx, cy, halfTangent, halfNormal, tangent, normal };
}
