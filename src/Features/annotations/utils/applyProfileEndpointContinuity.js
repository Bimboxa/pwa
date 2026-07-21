import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";

// Bakes the "endpoint continuity" rule into resolved profileLines: the FIRST
// and LAST vertex of each profile anchor on the polygon contour and inherit
// the contour's height (interpolated offsetTop) at their anchor spot — the
// user only edits interior vertices. Runs at resolve time (useAnnotationsV2)
// so 2D rendering, the elevation panel, the 3D shell build and the qties all
// read the same baked heights.
//
// Inputs are RESOLVED pixel-space rings/lines. Returns new profileLines where
// every vertex carries a numeric `height` and endpoints are `locked: true`.
// Arc contour segments are treated as straight chords for the height
// interpolation (heights vary linearly between ring vertices anyway).
// Interpolated offsetTop of the nearest ring edge at the projection of `p`.
// `rings` = arrays of pixel points carrying `offsetTop` (closed loops).
export function getContourHeightAt(p, rings) {
  let best = null;
  for (const ring of rings ?? []) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const n = ring.length;
    for (let i = 0; i < n; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      if (
        !Number.isFinite(a?.x) ||
        !Number.isFinite(a?.y) ||
        !Number.isFinite(b?.x) ||
        !Number.isFinite(b?.y)
      )
        continue;
      const proj = projectPointOnSegment(p, a, b);
      if (!proj) continue;
      if (!best || proj.distance < best.distance) {
        const ha = a.offsetTop ?? 0;
        const hb = b.offsetTop ?? 0;
        best = { distance: proj.distance, height: ha + (hb - ha) * proj.t };
      }
    }
  }
  return best ? best.height : 0;
}

export default function applyProfileEndpointContinuity({
  profileLines,
  points,
  cuts,
}) {
  if (!Array.isArray(profileLines) || !profileLines.length) return profileLines;

  const rings = [points ?? [], ...(cuts ?? []).map((c) => c?.points ?? [])];
  const contourHeightAt = (p) => getContourHeightAt(p, rings);

  return profileLines.map((l) => {
    const pts = l?.points;
    if (!Array.isArray(pts) || pts.length < 2) return l;
    const last = pts.length - 1;
    return {
      ...l,
      points: pts.map((p, i) =>
        i === 0 || i === last
          ? { ...p, height: contourHeightAt(p), locked: true }
          : { ...p, height: typeof p?.height === "number" ? p.height : 0 }
      ),
    };
  });
}
