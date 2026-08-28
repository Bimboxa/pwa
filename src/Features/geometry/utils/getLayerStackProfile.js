// Stack-distance profile of a layer STRIP over its underlying layers.
//
// Dependency free (plain {x, y} objects) so it can be replayed in node.
//
// The support polyline of the layer and the supports of all underlying layers
// are drawn on the SAME lines (colinear, snapped). For each arc-length station
// s of the layer's support, the stack distance is the sum of the thicknesses of
// the underlying layers covering s, and every step of that function is crossed
// with a 45° ramp of length |Δd| placed on the LOW side, reaching full height
// exactly at the underlying layer's edge.
//
// Returns a piecewise-linear profile `[{s, d}]` (unsigned, d ≥ 0) for
// offsetPolylineVariable, or null when the stack distance is identically zero.
//
// The 45° ramps are computed as a MAX-ENVELOPE: base step function ∨ one full
// "wedge" per step (a slope-±1 line anchored at the step's top, descending to
// zero). The envelope resolves the hairy cases exactly: a ramp longer than the
// low run is clipped by the next plateau/wedge, staircases of close steps chain
// into one continuous 45° slope, and a wedge clamped by the [0, L] domain
// simply starts/ends at the boundary height.

// Coincidence tolerance to the support's infinite line. Snapped drawing is
// sub-pixel; 1 px is far below any realistic layer thickness.
const TOL_LINE_PX = 1.0;
// Coverage intervals shorter than this are noise.
const MIN_OVERLAP_PX = 0.5;
// Union-merge gap tolerance between coverage intervals of one layer.
const TOL_MERGE_PX = 0.5;
const EPS_LEN = 1e-9;
const EPS_S = 1e-6;
const EPS_D = 1e-6;

// Distance from p to the infinite line through (a, b).
function distToLine(p, a, b, len) {
  return Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
}

// Coverage intervals [lo, hi] (arc-length stations on the support) of ONE
// underlying layer, merged.
function getCoverageIntervals(supportPts, stations, chunks) {
  const intervals = [];
  for (let i = 0; i < supportPts.length - 1; i++) {
    const a = supportPts[i];
    const b = supportPts[i + 1];
    const len = stations[i + 1] - stations[i];
    if (len < EPS_LEN) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    for (const chunk of chunks) {
      for (let j = 0; j < chunk.length - 1; j++) {
        const c = chunk[j];
        const d = chunk[j + 1];
        if (
          distToLine(c, a, b, len) > TOL_LINE_PX ||
          distToLine(d, a, b, len) > TOL_LINE_PX
        )
          continue;
        // Scalar projections along the support segment (orientation-agnostic).
        const tc = (c.x - a.x) * ux + (c.y - a.y) * uy;
        const td = (d.x - a.x) * ux + (d.y - a.y) * uy;
        const lo = Math.max(Math.min(tc, td), 0);
        const hi = Math.min(Math.max(tc, td), len);
        if (hi - lo > MIN_OVERLAP_PX) {
          intervals.push([stations[i] + lo, stations[i] + hi]);
        }
      }
    }
  }
  if (!intervals.length) return [];
  intervals.sort((u, v) => u[0] - v[0]);
  const merged = [intervals[0]];
  for (let k = 1; k < intervals.length; k++) {
    const last = merged[merged.length - 1];
    if (intervals[k][0] <= last[1] + TOL_MERGE_PX) {
      last[1] = Math.max(last[1], intervals[k][1]);
    } else {
      merged.push(intervals[k]);
    }
  }
  return merged;
}

/**
 * @param {Array<{x, y}>} supportPts - the layer's stored (support) points
 * @param {Array<{chunks: Array<Array<{x, y}>>, thicknessPx: number}>} underlying
 *   visible segment runs + unsigned band width of each underlying layer,
 *   bottom to top
 * @returns {Array<{s: number, d: number}>|null}
 */
export default function getLayerStackProfile(supportPts, underlying) {
  const n = supportPts?.length ?? 0;
  if (n < 2 || !underlying?.length) return null;

  const stations = [0];
  for (let i = 0; i < n - 1; i++) {
    stations.push(
      stations[i] +
        Math.hypot(
          supportPts[i + 1].x - supportPts[i].x,
          supportPts[i + 1].y - supportPts[i].y
        )
    );
  }
  const L = stations[n - 1];
  if (L < EPS_LEN) return null;

  // ---- base step function: sweep over coverage events ----
  const events = [];
  for (const u of underlying) {
    if (!(u.thicknessPx > 0)) continue;
    for (const [lo, hi] of getCoverageIntervals(
      supportPts,
      stations,
      u.chunks
    )) {
      events.push([lo, u.thicknessPx]);
      events.push([hi, -u.thicknessPx]);
    }
  }
  if (!events.length) return null;
  events.sort((a, b) => a[0] - b[0]);

  // pieces: [{from, to, v}] covering [0, L]; breakpoints where v changes.
  const pieces = [];
  let cursor = 0;
  let value = 0;
  let k = 0;
  while (k < events.length) {
    const s = events[k][0];
    let delta = 0;
    while (k < events.length && events[k][0] - s <= EPS_S) {
      delta += events[k][1];
      k++;
    }
    if (Math.abs(delta) < EPS_D) continue;
    if (s - cursor > EPS_S) pieces.push({ from: cursor, to: s, v: value });
    cursor = Math.max(cursor, s);
    value += delta;
  }
  if (L - cursor > EPS_S) pieces.push({ from: cursor, to: L, v: value });
  if (!pieces.length || pieces.every((p) => p.v < EPS_D)) return null;

  // ---- 45° wedges: one full triangle side per step, descending to zero ----
  // Step at station b between vLeft and vRight → wedge anchored at
  // (b, max(vLeft, vRight)), slope ±1 toward the low side, domain clamped to
  // [0, L]. The max-envelope with the base then produces the effective ramp.
  const wedges = [];
  for (let i = 0; i <= pieces.length; i++) {
    const vLeft = i > 0 ? pieces[i - 1].v : 0;
    const vRight = i < pieces.length ? pieces[i].v : 0;
    const b = i > 0 ? pieces[i - 1].to : 0;
    if (Math.abs(vLeft - vRight) < EPS_D) continue;
    if (i === 0 || i === pieces.length) continue; // domain boundary: no ramp
    const top = Math.max(vLeft, vRight);
    if (vRight > vLeft) {
      // step up at b → ramp on the left (low) side
      wedges.push({ from: Math.max(0, b - top), to: b, atB: top, slope: 1, b });
    } else {
      // step down at b → ramp on the right (low) side
      wedges.push({
        from: b,
        to: Math.min(L, b + top),
        atB: top,
        slope: -1,
        b,
      });
    }
  }

  const wedgeValue = (w, s) => {
    if (s < w.from - EPS_S || s > w.to + EPS_S) return -Infinity;
    return w.atB - Math.abs(s - w.b);
  };

  // Piecewise-constant base; at a breakpoint, side < 0 → left piece,
  // side ≥ 0 → right piece.
  const baseValue = (s, side) => {
    if (side < 0) {
      for (const p of pieces) {
        if (s <= p.to + EPS_S && s > p.from + EPS_S) return p.v;
      }
      return pieces[0].v; // s at the 0 boundary
    }
    for (const p of pieces) {
      if (s >= p.from - EPS_S && s < p.to - EPS_S) return p.v;
    }
    return pieces[pieces.length - 1].v; // s at the L boundary
  };

  const envelope = (s, side) => {
    let v = Math.max(0, baseValue(s, side));
    for (const w of wedges) v = Math.max(v, wedgeValue(w, s));
    return v;
  };

  // ---- candidate stations: every kink of the envelope is one of these ----
  const candidates = new Set([0, L]);
  for (const p of pieces) {
    candidates.add(p.from);
    candidates.add(p.to);
  }
  for (const w of wedges) {
    candidates.add(w.from);
    candidates.add(w.to);
    // wedge × plateau: solve atB - |s - b| = v on the wedge's low side.
    for (const p of pieces) {
      const s1 = w.b - w.slope * (w.atB - p.v);
      if (
        s1 >= Math.max(w.from, p.from) - EPS_S &&
        s1 <= Math.min(w.to, p.to) + EPS_S
      ) {
        candidates.add(Math.min(Math.max(s1, 0), L));
      }
    }
    // wedge × wedge (opposite slopes cross at one station).
    for (const w2 of wedges) {
      if (w2 === w || w.slope === w2.slope) continue;
      const up = w.slope === 1 ? w : w2;
      const down = w.slope === 1 ? w2 : w;
      // atB_u - (b_u - s) = atB_d - (s - b_d)
      const s2 = (down.atB + down.b - up.atB + up.b) / 2;
      if (
        s2 >= Math.max(up.from, down.from) - EPS_S &&
        s2 <= Math.min(up.to, down.to) + EPS_S
      ) {
        candidates.add(Math.min(Math.max(s2, 0), L));
      }
    }
  }

  const sorted = [...candidates].sort((a, b) => a - b);

  // ---- emit profile nodes (dedupe near-equal stations, keep jumps) ----
  const profile = [];
  for (const s of sorted) {
    if (profile.length && s - profile[profile.length - 1].s < EPS_S) continue;
    const left = envelope(s, -1);
    const right = envelope(s, +1);
    if (Math.abs(left - right) > EPS_D) {
      profile.push({ s, d: left });
      profile.push({ s, d: right });
    } else {
      profile.push({ s, d: (left + right) / 2 });
    }
  }

  // Simplify: drop nodes collinear with their neighbours.
  const simplified = profile.filter((node, i) => {
    if (i === 0 || i === profile.length - 1) return true;
    const a = profile[i - 1];
    const b = profile[i + 1];
    const span = b.s - a.s;
    if (span < EPS_S) return true;
    const interp = a.d + ((b.d - a.d) * (node.s - a.s)) / span;
    return Math.abs(interp - node.d) > EPS_D;
  });

  if (simplified.every((node) => node.d < EPS_D)) return null;
  return simplified;
}
