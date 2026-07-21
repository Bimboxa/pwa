import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";

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
// elevation, basemap-local meters for 3D — pass meterByPx=1 then):
//   - guidePoints: [{x, y, offsetBottom?}, ...] (the polyline chain)
//   - profilePoints: [{x, y, height, type?}, ...]
//   - meterByPx: meters per plan unit (used to compare section-space
//     distances where X is plan units and Z is meters)
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
// }
export default function getInlineExtrusionSetup({
  guidePoints,
  profilePoints,
  meterByPx = 1,
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
  const projOf = (p) =>
    projectPointOnPolyline({ x: p.x, y: p.y }, profileChain);
  const extremities = [segA, segB].map((p) => {
    const proj = projOf(p);
    return {
      s: proj ? proj.s : 0,
      z: p.offsetBottom ?? 0,
      x: p.x,
      y: p.y,
    };
  });

  // E = extremity whose section position is closest to a profile vertex
  // (section distances compare plan units on X and meters/meterByPx on Y).
  const pxPerMeter = meterByPx > 0 ? 1 / meterByPx : 1;
  const sectionDist = (ext, i) =>
    Math.hypot(
      cum[i] - ext.s,
      ((Number(profile[i].height) || 0) - ext.z) * pxPerMeter
    );
  let anchorExtremityIndex = 0;
  let bestD = Infinity;
  extremities.forEach((ext, ei) => {
    for (let i = 0; i < profile.length; i += 1) {
      const d = sectionDist(ext, i);
      if (d < bestD) {
        bestD = d;
        anchorExtremityIndex = ei;
      }
    }
  });
  const E = extremities[anchorExtremityIndex];

  // --- Section X axis → plan side of the guide ----------------------------
  // Right-of-tangent normal of the crossed segment.
  const tx = segB.x - segA.x;
  const ty = segB.y - segA.y;
  const tLen = Math.hypot(tx, ty) || 1;
  const nx = ty / tLen;
  const ny = -tx / tLen;
  // Plan direction of the profile at abscissa s_E.
  const planAt = (s) => {
    const sc = Math.max(0, Math.min(cum[cum.length - 1], s));
    for (let i = 0; i < profile.length - 1; i += 1) {
      if (sc <= cum[i + 1] || i === profile.length - 2) {
        const span = Math.max(cum[i + 1] - cum[i], 1e-9);
        const t = Math.max(0, Math.min(1, (sc - cum[i]) / span));
        return {
          x: profile[i].x + (profile[i + 1].x - profile[i].x) * t,
          y: profile[i].y + (profile[i + 1].y - profile[i].y) * t,
        };
      }
    }
    return { x: profile[0].x, y: profile[0].y };
  };
  const total = cum[cum.length - 1];
  const eps = Math.max(total * 1e-3, 1e-6);
  const p0 = planAt(Math.min(E.s, total - eps));
  const p1 = planAt(Math.min(E.s + eps, total));
  const dirDot = (p1.x - p0.x) * nx + (p1.y - p0.y) * ny;
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
    extents: { uMin, uMax },
  };
}
