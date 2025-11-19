/**
 * Apply fixed dimensions constraint to the second point of a rectangle
 * @param {Object} firstPointPx - First point in pixels {x, y}
 * @param {Object} candidatePointPx - Candidate second point in pixels {x, y}
 * @param {Object} fixedDimsMeters - Fixed dimensions in meters {x, y}
 * @param {number} meterPerPixel - Meters per pixel conversion factor
 * @returns {Object} Constrained second point in pixels {x, y}
 */
export default function applyFixedDimsConstraint({
  firstPointPx,
  candidatePointPx,
  fixedDimsMeters,
  meterPerPixel,
}) {
  if (!firstPointPx || !candidatePointPx) return candidatePointPx;

  const dimX = Number(fixedDimsMeters?.x);
  const dimY = Number(fixedDimsMeters?.y);

  // If either dimension is not valid, return candidate point unchanged
  if (
    !Number.isFinite(dimX) ||
    dimX <= 0 ||
    !Number.isFinite(dimY) ||
    dimY <= 0
  ) {
    return candidatePointPx;
  }

  if (!Number.isFinite(meterPerPixel) || meterPerPixel <= 0) {
    return candidatePointPx;
  }

  // Convert fixed dimensions from meters to pixels
  const targetWidthPx = dimX / meterPerPixel;
  const targetHeightPx = dimY / meterPerPixel;

  if (
    !Number.isFinite(targetWidthPx) ||
    targetWidthPx <= 0 ||
    !Number.isFinite(targetHeightPx) ||
    targetHeightPx <= 0
  ) {
    return candidatePointPx;
  }

  // Calculate the constrained second point
  // The rectangle will have the exact dimensions specified
  // We determine which corner to use based on the relative position of candidate to first point
  const dx = candidatePointPx.x - firstPointPx.x;
  const dy = candidatePointPx.y - firstPointPx.y;

  // Determine the sign based on the candidate position
  const signX = dx >= 0 ? 1 : -1;
  const signY = dy >= 0 ? 1 : -1;

  // Apply fixed dimensions from the first point
  return {
    x: firstPointPx.x + signX * targetWidthPx,
    y: firstPointPx.y + signY * targetHeightPx,
  };
}
