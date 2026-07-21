// (no imports — self-contained projections; the extremity projection must be
// UNCLAMPED, which projectPointOnPolyline does not provide)

// Registration of a POLYLINE "Extrusion" profile (annotation.profileLines
// drawn directly on the plan) against its guide polyline.
//
// Model (WYSIWYG with the Élévation section editor):
//   - The guide segment CROSSED by the profile in plan (or the nearest one)
//     projects onto the profile's vertical plane as a horizontal reference
//     line ("trait") whose extremities are the segment's endpoints.
//   - The registration extremity E = the segment endpoint whose section-space
//     position is closest to a profile vertex (snapping a vertex ON it makes
//     the registration exact).
//   - The swept cross-section is the profile expressed relative to E:
//     u = (s_vertex − s_E) × dirSign   (transverse offset, plan units,
//         mapped onto the guide's right-of-tangent normal; dirSign aligns
//         the section X axis with the plan side the profile is drawn on)
//     h = vertex height (meters, absolute — the sweep rides at
//         z = offsetZ + h, so what you see in the elevation view is what
//         gets built).
//
// Inputs are RESOLVED points in consistent plan units (pixels for 2D /
// elevation, basemap-local meters for 3D):
//   - guidePoints: [{x, y, offsetBottom?}, ...] (the polyline chain,
//     arc-expanded by the caller)
//   - profilePoints: [{x, y, height, type?}, ...]
//   - closeLine: whether the guide chain closes
//
// Returns null when degenerate, else:
// {
//   crossedSegIndex,                  // guide segment used as reference
//   extremities: [{ s, z, x, y }×2], // both endpoints in section coords
//                                     // (s = abscissa on the profile axis,
//                                     //  z = endpoint offsetBottom, meters)
//   anchorExtremityIndex,             // 0|1 — which one is E
//   dirSign,                          // +1|-1 (section X → plan side)
//   crossSection: [{ u, h, type? }],  // per profile vertex, u in plan units
//   extents: { uMin, uMax },          // transverse extents (plan units)
//   footprint: { sMin, sMax },        // FULL guide chain projected on the
//                                     // profile axis (unclamped abscissae) —
//                                     // the whole polyline footprint in the
//                                     // section view
//   medianS,                          // guide centroid (circle center)
//                                     // projected on the profile axis — the
//                                     // median axis / snap target
// }
export default function getInlineExtrusionSetup({
  guidePoints,
  profilePoints,
  closeLine = false,
}) {
  const guide = (guidePoints || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  const profile = (profilePoints || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (guide.length < 2 || profile.length < 2) return null;

  // Profile curvilinear abscissa per vertex.
  const cum = [0];
  for (let i = 1; i < profile.length; i += 1) {
    cum.push(
      cum[i - 1] +
        Math.hypot(
          profile[i].x - profile[i - 1].x,
          profile[i].y - profile[i - 1].y
        )
    );
  }
  const profileChain = profile.map((p) => ({ x: p.x, y: p.y }));

  // --- Reference guide segment: crossed by the profile, else nearest -------
  const segCount = closeLine ? guide.length : guide.length - 1;
  const intersect = (a, b, c, d) => {
    const rX = b.x - a.x;
    const rY = b.y - a.y;
    const sX = d.x - c.x;
    const sY = d.y - c.y;
    const denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-12) return false;
    const acX = c.x - a.x;
    const acY = c.y - a.y;
    const t = (acX * sY - acY * sX) / denom;
    const u = (acX * rY - acY * rX) / denom;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  const segDist = (a, b) => {
    // min distance from segment [a,b] to the profile vertices (cheap proxy)
    let best = Infinity;
    for (const p of profile) {
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby;
      if (len2 < 1e-18) continue;
      let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
      t = Math.max(0, Math.min(1, t));
      const dx = p.x - (a.x + abx * t);
      const dy = p.y - (a.y + aby * t);
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    return best;
  };

  let crossedSegIndex = -1;
  let nearestSegIndex = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < segCount; i += 1) {
    const a = guide[i];
    const b = guide[(i + 1) % guide.length];
    for (let j = 0; j < profile.length - 1 && crossedSegIndex < 0; j += 1) {
      if (intersect(a, b, profile[j], profile[j + 1])) crossedSegIndex = i;
    }
    if (crossedSegIndex >= 0) break;
    const d = segDist(a, b);
    if (d < nearestDist) {
      nearestDist = d;
      nearestSegIndex = i;
    }
  }
  if (crossedSegIndex < 0) crossedSegIndex = nearestSegIndex;

  const segA = guide[crossedSegIndex];
  const segB = guide[(crossedSegIndex + 1) % guide.length];

  // --- Extremities in section coordinates ---------------------------------
  // UNCLAMPED abscissa: a guide point may project BEYOND the profile's ends
  // (e.g. the profile starts strictly inside a circular guide). Clamping
  // would glue the registration origin onto the profile's end vertex and
  // shift the whole section — the abscissa must extrapolate along the first
  // / last segment instead, so the band boundaries pass exactly through the
  // profile extremities.
  const unclampedS = (p) => {
    let best = null;
    for (let i = 0; i < profileChain.length - 1; i += 1) {
      const a = profileChain[i];
      const b = profileChain[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby;
      if (len2 < 1e-18) continue;
      const len = Math.sqrt(len2);
      const tRaw = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
      // Extrapolation allowed only on the end segments (interior overlaps
      // are owned by the neighbor segment).
      const tMin = i === 0 ? -Infinity : 0;
      const tMax = i === profileChain.length - 2 ? Infinity : 1;
      const t = Math.max(tMin, Math.min(tMax, tRaw));
      const fx = a.x + abx * t;
      const fy = a.y + aby * t;
      const d2 = (p.x - fx) ** 2 + (p.y - fy) ** 2;
      if (!best || d2 < best.d2) {
        best = { d2, s: cum[i] + t * len };
      }
    }
    return best ? best.s : 0;
  };
  const extremities = [segA, segB].map((p) => ({
    s: unclampedS(p),
    z: p.offsetBottom ?? 0,
    x: p.x,
    y: p.y,
  }));

  // Full guide footprint on the section plane: every guide vertex projected
  // (unclamped) onto the profile axis.
  let footSMin = Infinity;
  let footSMax = -Infinity;
  for (const p of guide) {
    const s = unclampedS(p);
    if (s < footSMin) footSMin = s;
    if (s > footSMax) footSMax = s;
  }

  // Median axis: the guide's CENTER (centroid of its vertices — the circle
  // center for a circular guide, the segment midpoint for a straight one)
  // projected (unclamped) onto the profile axis. Marks the middle of the
  // projected main annotation in the section view and is a snap target.
  let cX = 0;
  let cY = 0;
  for (const p of guide) {
    cX += p.x;
    cY += p.y;
  }
  const centroid = { x: cX / guide.length, y: cY / guide.length };
  const medianS = unclampedS(centroid);

  // E = extremity closest to the profile IN PLAN (perpendicular distance to
  // the profile chain). The section-space abscissa alone would let an
  // off-plane extremity win (its projection can land closer along the axis
  // while sitting far from the section plane), shifting the registration —
  // the guide point that actually meets the section plane must anchor it.
  const planDistToProfile = (p) => {
    let best = Infinity;
    for (let i = 0; i < profileChain.length - 1; i += 1) {
      const a = profileChain[i];
      const b = profileChain[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby;
      if (len2 < 1e-18) continue;
      let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
      t = Math.max(0, Math.min(1, t));
      const dx = p.x - (a.x + abx * t);
      const dy = p.y - (a.y + aby * t);
      const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
    return best;
  };
  const anchorExtremityIndex =
    planDistToProfile(extremities[0]) <= planDistToProfile(extremities[1])
      ? 0
      : 1;
  const E = extremities[anchorExtremityIndex];

  // --- Section X axis → plan side of the guide ----------------------------
  // Right-of-tangent normal of the crossed segment.
  const tx = segB.x - segA.x;
  const ty = segB.y - segA.y;
  const tLen = Math.hypot(tx, ty) || 1;
  const nx = ty / tLen;
  const ny = -tx / tLen;
  const total = cum[cum.length - 1];
  // Plan TANGENT DIRECTION of the profile at abscissa s (segment vector, not
  // a sampled point) — extrapolating past the ends by reusing the nearest end
  // segment's direction. Using the segment vector directly (instead of
  // sampling two nearby points and differencing) avoids a degenerate
  // zero-vector: E is routinely EXTRAPOLATED before the profile's first
  // vertex (E.s < 0, e.g. a profile starting strictly inside a circular
  // guide) — sampling at s=E.s and s=E.s+eps would both clamp to profile[0]
  // in that case, collapsing dirDot to 0 and silently defaulting dirSign to
  // +1 regardless of the profile's real direction (wrong side of the guide).
  const tangentAt = (s) => {
    if (s <= 0) {
      return {
        dx: profile[1].x - profile[0].x,
        dy: profile[1].y - profile[0].y,
      };
    }
    if (s >= total) {
      const a = profile[profile.length - 2];
      const b = profile[profile.length - 1];
      return { dx: b.x - a.x, dy: b.y - a.y };
    }
    for (let i = 0; i < profile.length - 1; i += 1) {
      if (s <= cum[i + 1] || i === profile.length - 2) {
        return {
          dx: profile[i + 1].x - profile[i].x,
          dy: profile[i + 1].y - profile[i].y,
        };
      }
    }
    return { dx: profile[1].x - profile[0].x, dy: profile[1].y - profile[0].y };
  };
  const { dx: tdx, dy: tdy } = tangentAt(E.s);
  const dirDot = tdx * nx + tdy * ny;
  const dirSign = dirDot >= 0 ? 1 : -1;

  // --- Cross-section + extents --------------------------------------------
  const crossSection = profile.map((p, i) => ({
    u: (cum[i] - E.s) * dirSign,
    h: Number(p.height) || 0,
    ...(p.type === "circle" ? { type: "circle" } : {}),
  }));
  let uMin = Infinity;
  let uMax = -Infinity;
  for (const c of crossSection) {
    if (c.u < uMin) uMin = c.u;
    if (c.u > uMax) uMax = c.u;
  }

  return {
    crossedSegIndex,
    extremities,
    anchorExtremityIndex,
    dirSign,
    crossSection,
    footprint: { sMin: footSMin, sMax: footSMax },
    medianS,
    extents: { uMin, uMax },
  };
}
