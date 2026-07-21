// DOME shell field: "revolution + drape" model.
//
// Each constraint line (profile or iso line) generates a LOCAL DOME: the
// surface of revolution of the line around the VERTICAL axis through the
// midpoint M of the segment joining its two endpoints. Radially, the dome is
// the upper envelope h_i(r) of the line's sampled (r = plan distance to M,
// h = height) points — a diameter arch on a disc revolves into a true dome, a
// constant-height iso chord into a flat plateau.
//
// The shell is then a "sheet" (drap) laid over the local domes:
//   z(x, y) = max( base(x, y), max_i h_i(|p − M_i|) )
// where base = the contour's interpolated offsetTop at the nearest ring point
// (the sheet falls back onto the polygon base away from the domes). Inside a
// dome's inner hole (r < rMin, line not reaching its axis) the sheet spans
// flat at h_i(rMin); beyond rMax the dome contributes nothing.
//
// Output: { points, drapeAt } where `points` is the Steiner field
// [{x, y, offsetTop}] (exact on-line samples first, then grid nodes)
// evaluated through the drape, and `drapeAt({x, y})` evaluates the sheet
// height anywhere (used to pin the hole rims: the sheet stops SHARP at a
// cut, it must not fall back to the ring's own offsets there). Consumed by
// buildDomeTopMesh (Delaunay top mesh) in triangulateAnnotationGeometry.
//
// Units: x/y in any consistent 2D unit (basemap-local for 3D, meters for
// qties); heights in meters (offsetTop semantics). Vertical S-C-S arcs of the
// profiles must be expanded BEFORE calling (expandShellProfileArcs).
//
// Inputs:
//   - contour: outer ring [{x, y, offsetTop?}, ...] (arc-expanded)
//   - holes: cut rings (same shape) — the sheet simply does not cover them:
//     grid nodes and on-line samples inside a hole are excluded (a profile
//     may CROSS a hole; its dome still shapes the surface around it).
//   - profiles: [{ polyline: [{x, y, height}, ...] }]
//
// Grid spacing used by the drape field: ~gridN cells across the larger bbox
// side, degraded so the node count stays under maxNodes (the Delaunay meshing
// is O(n²)). Exported so buildDomeTopMesh densifies the rings with the SAME
// spacing (ring edges must be shorter than the grid step to survive the
// Delaunay — see the ridge-edge note below).
export function computeDomeGridSpacing(contour, gridN = 24, maxNodes = 800) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of contour || []) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  if (!Number.isFinite(bboxW) || !Number.isFinite(bboxH)) return null;
  if (bboxW <= 0 || bboxH <= 0) return null;
  let h = Math.max(bboxW, bboxH) / gridN;
  const estimate = (bboxW / h) * (bboxH / h);
  if (estimate > maxNodes * 1.6) {
    h *= Math.sqrt(estimate / (maxNodes * 1.6));
  }
  return h;
}

// Returns the field or null when it cannot apply.
export default function computeDomeSteinerField({
  contour,
  holes = [],
  profiles = [],
  gridN = 24,
  maxNodes = 800,
}) {
  if (!Array.isArray(contour) || contour.length < 3) return null;

  const lines = (profiles || [])
    .map((prof) =>
      (prof?.polyline || []).filter(
        (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      )
    )
    .filter((pl) => pl.length >= 2);
  if (lines.length === 0) return null;

  const validHoles = (holes || []).filter(
    (h) => Array.isArray(h) && h.length >= 3
  );

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of contour) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  if (!Number.isFinite(bboxW) || !Number.isFinite(bboxH)) return null;
  if (bboxW <= 0 || bboxH <= 0) return null;

  const h = computeDomeGridSpacing(contour, gridN, maxNodes);
  if (!h) return null;

  const pointInRing = (p, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
    return inside;
  };
  const insidePolygon = (p) => {
    if (!pointInRing(p, contour)) return false;
    for (const hole of validHoles) if (pointInRing(p, hole)) return false;
    return true;
  };

  // Interpolated contour offsetTop at the nearest ring point (outer + holes).
  const rings = [contour, ...validHoles];
  const contourHeightAt = (p) => {
    let best = null;
    for (const ring of rings) {
      const m = ring.length;
      for (let i = 0; i < m; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % m];
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const len2 = abx * abx + aby * aby;
        if (len2 < 1e-18) continue;
        let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
        t = Math.max(0, Math.min(1, t));
        const dx = p.x - (a.x + abx * t);
        const dy = p.y - (a.y + aby * t);
        const d2 = dx * dx + dy * dy;
        if (!best || d2 < best.d2) {
          const ha = a.offsetTop ?? 0;
          const hb = b.offsetTop ?? 0;
          best = { d2, height: ha + (hb - ha) * t };
        }
      }
    }
    return best ? best.height : 0;
  };

  // Distance² to the nearest contour/hole ring (drop sliver-prone nodes).
  const contourDist2 = (p) => {
    let best = Infinity;
    for (const ring of rings) {
      const m = ring.length;
      for (let i = 0; i < m; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % m];
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
    }
    return best;
  };

  // --- Local domes (revolution of each line around its own axis) ----------
  // Radial samples (r, h) along the line, densified so the envelope follows
  // the plan geometry (r is not linear in the curvilinear abscissa). The line
  // is SPLIT at its closest approach to the axis and only the LONGEST strand
  // is revolved — a clean single generatrix instead of the two overlapping
  // branches of a through-going profile.
  const SAMPLE_STEP = h / 2;
  const domes = lines.map((pl) => {
    const M = {
      x: (pl[0].x + pl[pl.length - 1].x) / 2,
      y: (pl[0].y + pl[pl.length - 1].y) / 2,
    };
    // Dense samples along the whole line, with cumulative 3D length (plan +
    // height): a straight profile has equal-length strands in plan (the axis
    // IS the midpoint), so the split must weigh the vertical development —
    // the strand carrying the apex is the longer generatrix.
    const all = [];
    let cum = 0;
    const pushSample = (x, y, hh) => {
      if (all.length > 0) {
        const prev = all[all.length - 1];
        cum += Math.hypot(x - prev.x, y - prev.y, hh - prev.h);
      }
      all.push({ x, y, h: hh, s: cum, r: Math.hypot(x - M.x, y - M.y) });
    };
    for (let i = 0; i < pl.length; i++) {
      const hi = Number(pl[i].height) || 0;
      pushSample(pl[i].x, pl[i].y, hi);
      if (i < pl.length - 1) {
        const a = pl[i];
        const b = pl[i + 1];
        const hb = Number(b.height) || 0;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.floor(len / SAMPLE_STEP);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          pushSample(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t,
            hi + (hb - hi) * t
          );
        }
      }
    }
    // Split at the closest approach to the axis; revolve the longest strand.
    let iMin = 0;
    for (let i = 1; i < all.length; i++) {
      if (all[i].r < all[iMin].r) iMin = i;
    }
    const lenA = all[iMin].s - all[0].s;
    const lenB = all[all.length - 1].s - all[iMin].s;
    const strand = lenA >= lenB ? all.slice(0, iMin + 1) : all.slice(iMin);
    const samples = strand.map(({ r, h: hh }) => ({ r, h: hh }));
    let rMin = Infinity;
    let rMax = -Infinity;
    let hAtRMin = 0;
    for (const s of samples) {
      if (s.r < rMin) {
        rMin = s.r;
        hAtRMin = s.h;
      }
      if (s.r > rMax) rMax = s.r;
    }
    return { M, samples, rMin, rMax, hAtRMin };
  });

  // Revolved height of one dome at radius r: upper envelope over the line's
  // consecutive (r, h) sample pairs; flat cap inside the inner hole; nothing
  // beyond the outer radius.
  const domeHeightAt = (dome, r) => {
    if (r > dome.rMax + 1e-9) return null;
    let best = null;
    if (r <= dome.rMin) {
      best = dome.hAtRMin;
    }
    const s = dome.samples;
    for (let i = 0; i < s.length - 1; i++) {
      const r0 = s[i].r;
      const r1 = s[i + 1].r;
      const lo = Math.min(r0, r1);
      const hi = Math.max(r0, r1);
      if (r < lo - 1e-9 || r > hi + 1e-9) continue;
      const span = r1 - r0;
      const t = Math.abs(span) < 1e-12 ? 0 : (r - r0) / span;
      const hh = s[i].h + (s[i + 1].h - s[i].h) * t;
      if (best == null || hh > best) best = hh;
    }
    return best;
  };

  // The drape: sheet laid over the local domes, resting on the contour base
  // elsewhere.
  const drapeAt = (p) => {
    let z = contourHeightAt(p);
    for (const dome of domes) {
      const r = Math.hypot(p.x - dome.M.x, p.y - dome.M.y);
      const hh = domeHeightAt(dome, r);
      if (hh != null && hh > z) z = hh;
    }
    return z;
  };

  // Distance² to the nearest constraint line (drop grid nodes hugging the
  // ridge samples so the Delaunay keeps the ridge edges).
  const lineDist2 = (p) => {
    let best = Infinity;
    for (const pl of lines) {
      for (let i = 0; i < pl.length - 1; i++) {
        const a = pl[i];
        const b = pl[i + 1];
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
    }
    return best;
  };

  // --- Grid nodes evaluated through the drape -----------------------------
  const cols = Math.max(1, Math.floor(bboxW / h));
  const rows = Math.max(1, Math.floor(bboxH / h));
  const x0 = minX + (bboxW - cols * h) / 2 + h / 2;
  const y0 = minY + (bboxH - rows * h) / 2 + h / 2;

  const NEAR_CONTOUR_2 = 0.3 * h * (0.3 * h);
  const NEAR_LINE_2 = 0.55 * h * (0.55 * h);

  const gridOut = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      // Deterministic sub-cell jitter: breaks the exact cocircular quads of a
      // regular grid, which destabilize the downstream Bowyer-Watson Delaunay
      // triangulation. Magnitude 2% of the spacing — invisible, but enough.
      const jx = (((i * 7919 + j * 104729) % 1000) / 1000 - 0.5) * 0.04 * h;
      const jy = (((i * 104729 + j * 7919) % 1000) / 1000 - 0.5) * 0.04 * h;
      const p = { x: x0 + i * h + jx, y: y0 + j * h + jy };
      if (!insidePolygon(p)) continue;
      if (contourDist2(p) < NEAR_CONTOUR_2) continue;
      if (lineDist2(p) < NEAR_LINE_2) continue;
      gridOut.push({ x: p.x, y: p.y, offsetTop: drapeAt(p) });
    }
  }

  // --- Exact on-line samples ----------------------------------------------
  // Every line vertex + samples every h/2 along segments, evaluated through
  // the drape (a line covered by a higher dome lies UNDER the sheet — the
  // sheet wins). Dense sampling also keeps the ridge edges in the Delaunay:
  // each sub-segment's diametral circle (radius h/4) is empty since every
  // other point sits at least ~0.55h from the line.
  const exact = [];
  const pushExact = (x, y) => {
    // Samples outside the sheet's footprint (inside a hole / off the
    // polygon, e.g. a profile crossing a cut) are not mesh vertices.
    if (!insidePolygon({ x, y })) return;
    exact.push({ x, y, offsetTop: drapeAt({ x, y }) });
  };
  for (const pl of lines) {
    for (let i = 0; i < pl.length; i++) {
      pushExact(pl[i].x, pl[i].y);
      if (i < pl.length - 1) {
        const a = pl[i];
        const b = pl[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.floor(len / SAMPLE_STEP);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          pushExact(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        }
      }
    }
  }

  if (exact.length === 0 && gridOut.length === 0) return null;

  return { points: [...exact, ...gridOut], drapeAt };
}
