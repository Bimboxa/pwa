// Extend an acquired band along its axis, starting from the cursor.
//
// `classify(a)` describes the transverse scanline at axial offset `a` from
// the candidate center: true (band), false (blank / other), "ink" (darker
// line), "occluded" (foreign color, junction) or null (hard stop: exclusion
// mask, source footprint, image border).
//
// `limits` are run lengths in scanlines: `gap` blank scanlines split the band
// (an opening), `ink` and `occlusion` are stepped over up to that length.
export default function extendSegmentFromCursor({
  classify,
  limits,
  cursorAlong,
  seedReach,
  maxLength,
}) {
  // Start on the nearest valid scanline: the cursor may sit on a dimension,
  // on hatch whitespace or slightly beyond the end of the band.
  let seed = null;
  const start = Math.round(cursorAlong);
  for (let d = 0; d <= seedReach && seed === null; d++) {
    if (classify(start + d) === true) seed = start + d;
    else if (d && classify(start - d) === true) seed = start - d;
  }
  if (seed === null) return null;
  const walk = (sign) => {
    let last = seed,
      gap = 0,
      occlusion = 0,
      ink = 0;
    for (let i = 1; i <= maxLength; i++) {
      const a = seed + i * sign;
      const valid = classify(a);
      // A mask/image boundary is a hard stop; a few missing scanlines may be
      // antialiasing or hatch whitespace, but an opening must split the wall.
      if (valid === null) break;
      if (valid === "occluded") {
        if (++occlusion > limits.occlusion) break;
      } else if (valid === "ink") {
        if (++ink > limits.ink) break;
      } else if (valid) {
        last = a;
        gap = 0;
        occlusion = 0;
        ink = 0;
      } else if (++gap > limits.gap) break;
    }
    return last + sign * 0.5;
  };
  return { lo: walk(-1), hi: walk(1), seed };
}

// Keep the part of a span over which the band stays itself.
//
// A scanline test alone follows any surface of similar gray level. Windows
// are therefore checked outward from the seed: `matches(center)` tells whether
// the window centered there still shows the acquired band (true / false), or
// null when it cannot tell. Isolated failures (a label) are stepped over; a
// failing run, or a failing tail, cuts the span at the first transverse line
// or blank scanline that is followed by something else: a drafting line
// inside the wall is followed by the same band.
export function confirmSpan({ span, length, matches, classify }) {
  const half = length / 2;
  const confirm = (sign) => {
    const end = sign > 0 ? span.hi : span.lo;
    let good = span.seed,
      firstFail = null,
      failing = 0;
    for (let k = 0; ; k++) {
      let center = span.seed + sign * k * half;
      const last = sign * (center + sign * half - end) >= 0;
      if (last) center = end - sign * half;
      if (sign * (center - span.seed) < 0) break;
      const value = matches(center);
      if (value) {
        good = center;
        firstFail = null;
        failing = 0;
      } else if (value === false) {
        firstFail ??= center;
        if (++failing >= 3) break;
      }
      if (last) break;
    }
    if (firstFail === null) return end;
    // The last accepted window may straddle the change.
    const limit = firstFail + sign * half;
    for (
      let a = Math.round(good - sign * half);
      sign * (limit - a) >= 0;
      a += sign
    ) {
      const kind = classify(a);
      if (kind === null) return a - sign * 0.5;
      if (kind !== "ink" && kind !== false) continue;
      if (matches(a + sign * (half + 0.5)) === false) return a - sign * 0.5;
    }
    // No line marks the change (a crossing band, a bend): keep the first
    // failing window whole and let the caller pull the end back to the faces.
    return sign > 0 ? Math.min(end, limit) : Math.max(end, limit);
  };
  return { ...span, lo: confirm(-1), hi: confirm(1) };
}
