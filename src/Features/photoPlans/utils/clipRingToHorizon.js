// Clip a photo-space ring to the VALID side of a photoPlan homography's
// horizon (w > 0 — H is sign-normalized so the calibrated zone lies there).
// Sutherland–Hodgman against the half-plane w >= eps, with eps a small
// fraction of the ring's max w so the kept geometry stays clear of the
// singularity (points ON the horizon map to infinity).
//
// `points`: PIXEL coords, arcs already tessellated (clipping would break
// S-C-S triplets). Returns the clipped pixel ring, or null when the whole
// ring is on/beyond the horizon. No-op (same array) when nothing crosses.

const EPS_FRACTION = 0.03;

export default function clipRingToHorizon({ points, imageSize, H }) {
  if (!points?.length || !H || !imageSize?.width || !imageSize?.height) {
    return null;
  }
  const [, , , , , , h6, h7, h8] = H;
  const wOf = (p) =>
    h6 * (p.x / imageSize.width) + h7 * (p.y / imageSize.height) + h8;

  const ws = points.map(wOf);
  const maxW = Math.max(...ws);
  if (!(maxW > 0)) return null;
  const eps = EPS_FRACTION * maxW;
  if (ws.every((w) => w >= eps)) return points;

  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const wa = ws[i];
    const wb = ws[(i + 1) % points.length];
    const aIn = wa >= eps;
    const bIn = wb >= eps;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (eps - wa) / (wb - wa);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return out.length >= 3 ? out : null;
}
