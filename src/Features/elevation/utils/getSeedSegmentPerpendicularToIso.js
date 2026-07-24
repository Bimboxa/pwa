// Default "visualization segment" (seed) for a POLYGON carrying isoHeightLines:
// the ring edge whose direction is the MOST PERPENDICULAR to the iso lines, so
// the elevation projects ACROSS the contour lines (x runs down the slope) —
// the seed segment defines the projection axis in buildElevationProfile.
//
// The iso direction is the undirected mean of every iso line's chord
// (first → last), computed with the doubled-angle trick so opposite chord
// orientations and several parallel contour lines average correctly.
//
// Returns the segment index (0-based, a segment i joins points[i] and
// points[i+1]); 0 when there is no usable iso direction or too few points.
export default function getSeedSegmentPerpendicularToIso(
  points,
  isoLines,
  { closeLine = true } = {}
) {
  const pts = (points || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  const n = pts.length;
  if (n < 2) return 0;

  // Undirected mean of the iso chords (doubled angle).
  let sx = 0;
  let sy = 0;
  for (const line of isoLines || []) {
    const lp = (line?.points || []).filter(
      (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
    );
    if (lp.length < 2) continue;
    const dx = lp[lp.length - 1].x - lp[0].x;
    const dy = lp[lp.length - 1].y - lp[0].y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const ux = dx / len;
    const uy = dy / len;
    sx += ux * ux - uy * uy; // cos 2θ
    sy += 2 * ux * uy; // sin 2θ
  }
  if (Math.hypot(sx, sy) < 1e-9) return 0; // no usable iso direction

  const isoAngle = 0.5 * Math.atan2(sy, sx);
  const ix = Math.cos(isoAngle);
  const iy = Math.sin(isoAngle);

  // Segment most perpendicular to the iso direction → minimize |cosθ|.
  const segCount = closeLine ? n : n - 1;
  let best = 0;
  let bestDot = Infinity;
  for (let i = 0; i < segCount; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const d = Math.abs((dx / len) * ix + (dy / len) * iy);
    if (d < bestDot) {
      bestDot = d;
      best = i;
    }
  }
  return best;
}
