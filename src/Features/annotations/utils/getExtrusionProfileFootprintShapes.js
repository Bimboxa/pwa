import { expandArcsInPathWithHiddenMap } from "Features/geometry/utils/arcSampling";

const GUIDE_ARC_SAMPLES = 6;

/**
 * Exact planar footprint (pixel space) of an EXTRUSION_PROFILE annotation: the
 * XY projection of the swept profile. Equals, per visible guide segment, the
 * guide segment offset along its right-of-tangent normal by the profile's
 * horizontal extent [xMin..xMax]. Matches the 3D prism geometries' projection,
 * so the surface quantity stays consistent with the 3D boolean carve.
 *
 * @param {Object} annotation       pixel-resolved guide annotation (POLYLINE/STRIP)
 * @param {number} meterByPx        guide basemap scale
 * @param {Object} profileRes       resolveProfileFromDb() result
 * @returns {Array<{points:Array<{x,y}>, cuts:Array}>|null}
 */
export default function getExtrusionProfileFootprintShapes(
  annotation,
  meterByPx,
  profileRes
) {
  if (!profileRes || !profileRes.anchorPx || !meterByPx) return null;

  const orient = (annotation.extrusionOrientation ?? 1) < 0 ? -1 : 1;

  // Profile horizontal extent in meters (union across all profile parts).
  let xMin = Infinity;
  let xMax = -Infinity;
  for (const profile of profileRes.profiles) {
    const mbp = profile.baseMap?.meterByPx;
    if (!mbp || !profile.pointsPx) continue;
    for (const p of profile.pointsPx) {
      const x = (p.x - profileRes.anchorPx.x) * mbp * orient;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
    }
  }
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax - xMin < 1e-9) {
    return null;
  }

  // Extent in guide pixels.
  const oMin = xMin / meterByPx;
  const oMax = xMax / meterByPx;

  const { points: pts, hiddenSegmentsIdx } = expandArcsInPathWithHiddenMap(
    annotation.points || [],
    GUIDE_ARC_SAMPLES,
    annotation.hiddenSegmentsIdx || [],
    !!annotation.closeLine
  );
  if (!pts || pts.length < 2) return null;

  const hidden = new Set(hiddenSegmentsIdx || []);
  const n = pts.length;
  const segCount = annotation.closeLine ? n : n - 1;

  const shapes = [];
  for (let i = 0; i < segCount; i++) {
    if (hidden.has(i)) continue;
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const tx = dx / len;
    const ty = dy / len;
    // Right-of-tangent normal (matches buildExtrudedProfileSolidGeometries).
    const nx = ty;
    const ny = -tx;
    shapes.push({
      points: [
        { x: a.x + oMin * nx, y: a.y + oMin * ny },
        { x: a.x + oMax * nx, y: a.y + oMax * ny },
        { x: b.x + oMax * nx, y: b.y + oMax * ny },
        { x: b.x + oMin * nx, y: b.y + oMin * ny },
      ],
      cuts: [],
    });
  }

  return shapes.length > 0 ? shapes : null;
}
