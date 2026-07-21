// DOME shell solver: computes a Steiner point field whose offsetTop values
// form a harmonic (soap-film / membrane) surface constrained by:
//   - the polygon contour heights (Dirichlet boundary = interpolated
//     offsetTop along the ring), and
//   - the profile polylines (Dirichlet ridges = per-vertex heights).
//
// The output points are fed through the EXISTING innerPoints machinery of
// triangulateAnnotationGeometry (insertSteinerPoints + per-vertex offsetTop),
// so walls, areas and volume stay consistent for free.
//
// Method: regular grid over the polygon bbox, 4-neighbor graph Laplacian,
// Gauss-Seidel sweeps with successive over-relaxation (SOR). Neighbors
// falling outside the polygon contribute the contour's interpolated offsetTop
// at the ghost position (first-order boundary condition). Nodes within h/2 of
// a profile are fixed to the profile's interpolated height. Exact constraint
// points (every profile vertex + samples every `h` along segments) are
// appended so the surface passes exactly through the profiles.
//
// Units: x/y in any consistent 2D unit (basemap-local for 3D, pixels for
// qties) — the harmonic interpolation of the height VALUE field is
// unit-independent. Heights in meters (offsetTop semantics).
//
// Inputs:
//   - contour: outer ring [{x, y, offsetTop?}, ...] (arc-expanded)
//   - holes: cut rings (same shape) — V1 callers bail to TENT when holes
//     exist, but the solver itself tolerates them (nodes inside holes are
//     excluded and hole rings contribute boundary values).
//   - profiles: [{ polyline: [{x, y, height}, ...] }] (post
//     prepareShellProfiles: junctions inserted, heights baked)
//
// Returns [{ x, y, offsetTop }] (exact profile samples first, then grid
// nodes) or null when the solve cannot apply.
export default function computeDomeSteinerField({
  contour,
  holes = [],
  profiles = [],
  gridN = 24,
  maxNodes = 800,
  maxSweeps = 400,
  convergenceTol = 1e-4,
  omega = 1.8,
}) {
  if (!Array.isArray(contour) || contour.length < 3) return null;

  const segments = [];
  for (const prof of profiles || []) {
    const pl = (prof?.polyline || []).filter(
      (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
    );
    for (let i = 0; i < pl.length - 1; i++) {
      segments.push({
        ax: pl[i].x,
        ay: pl[i].y,
        ah: Number(pl[i].height) || 0,
        bx: pl[i + 1].x,
        by: pl[i + 1].y,
        bh: Number(pl[i + 1].height) || 0,
      });
    }
  }
  if (segments.length === 0) return null;

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

  // Grid spacing: ~gridN cells across the larger bbox side, degraded so the
  // interior node count stays under maxNodes (Steiner insertion is O(n × t)).
  let h = Math.max(bboxW, bboxH) / gridN;
  const estimate = (bboxW / h) * (bboxH / h);
  if (estimate > maxNodes * 1.6) {
    h *= Math.sqrt(estimate / (maxNodes * 1.6));
  }

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

  // Distance to the nearest profile segment + interpolated height there.
  const profileAt = (p) => {
    let best = null;
    for (const s of segments) {
      const abx = s.bx - s.ax;
      const aby = s.by - s.ay;
      const len2 = abx * abx + aby * aby;
      if (len2 < 1e-18) continue;
      let t = ((p.x - s.ax) * abx + (p.y - s.ay) * aby) / len2;
      t = Math.max(0, Math.min(1, t));
      const dx = p.x - (s.ax + abx * t);
      const dy = p.y - (s.ay + aby * t);
      const d2 = dx * dx + dy * dy;
      if (!best || d2 < best.d2) {
        best = { d2, height: s.ah + (s.bh - s.ah) * t };
      }
    }
    return best;
  };
  // Distance to the nearest contour/hole ring (to drop sliver-prone nodes).
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

  // --- Build the grid ------------------------------------------------------
  const cols = Math.max(1, Math.floor(bboxW / h));
  const rows = Math.max(1, Math.floor(bboxH / h));
  const x0 = minX + (bboxW - cols * h) / 2 + h / 2;
  const y0 = minY + (bboxH - rows * h) / 2 + h / 2;

  const NEAR_CONTOUR_2 = 0.3 * h * (0.3 * h); // drop sliver-prone nodes
  const CONSTRAINT_R2 = 0.5 * h * (0.5 * h); // profile capture radius

  const idxGrid = new Int32Array(cols * rows).fill(-1);
  const nodes = []; // { x, y, fixed, value, profD2 }
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
      const prof = profileAt(p);
      const fixed = prof && prof.d2 <= CONSTRAINT_R2;
      idxGrid[j * cols + i] = nodes.length;
      nodes.push({
        x: p.x,
        y: p.y,
        fixed: !!fixed,
        value: fixed ? prof.height : 0,
        profD2: prof ? prof.d2 : Infinity,
      });
    }
  }
  if (nodes.length === 0) return null;

  // --- Precompute neighbor slots for free nodes ---------------------------
  // Each slot is either { node: idx } or { ghost: boundaryValue }.
  const free = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = idxGrid[j * cols + i];
      if (k < 0 || nodes[k].fixed) continue;
      const slots = [];
      const neighbor = (ii, jj) => {
        const inBounds = ii >= 0 && ii < cols && jj >= 0 && jj < rows;
        const nk = inBounds ? idxGrid[jj * cols + ii] : -1;
        if (nk >= 0) {
          slots.push({ node: nk });
        } else {
          // Ghost outside the polygon (or dropped near-contour node): the
          // boundary condition is the contour height at the ghost position.
          slots.push({
            ghost: contourHeightAt({ x: x0 + ii * h, y: y0 + jj * h }),
          });
        }
      };
      neighbor(i - 1, j);
      neighbor(i + 1, j);
      neighbor(i, j - 1);
      neighbor(i, j + 1);
      free.push({ k, slots });
    }
  }

  // Initialize free nodes with their boundary estimate for faster
  // convergence (pure ghost average when available, else 0).
  for (const f of free) {
    let sum = 0;
    for (const s of f.slots) {
      sum += s.ghost !== undefined ? s.ghost : nodes[s.node].value;
    }
    nodes[f.k].value = sum / f.slots.length;
  }

  // --- Gauss-Seidel + SOR sweeps ------------------------------------------
  if (free.length > 0) {
    for (let sweep = 0; sweep < maxSweeps; sweep++) {
      let maxDelta = 0;
      for (const f of free) {
        let sum = 0;
        for (const s of f.slots) {
          sum += s.ghost !== undefined ? s.ghost : nodes[s.node].value;
        }
        const target = sum / f.slots.length;
        const prev = nodes[f.k].value;
        const next = prev + omega * (target - prev);
        nodes[f.k].value = next;
        const d = Math.abs(next - prev);
        if (d > maxDelta) maxDelta = d;
      }
      if (maxDelta < convergenceTol) break;
    }
  }

  // --- Exact profile constraint points ------------------------------------
  // Every profile vertex + samples every h/2 along segments, so the surface
  // passes exactly through the profiles (piecewise-linear along them) AND the
  // downstream Delaunay keeps the ridge sub-segments as mesh edges: with
  // samples h/2 apart, each sub-segment's diametral circle has radius h/4,
  // and every non-ridge point sits at least ~0.55h from the ridge line (grid
  // nodes near the profiles are excluded below) — no invasion, no flips.
  const exact = [];
  const pushExact = (x, y, height) => {
    exact.push({ x, y, offsetTop: height });
  };
  const SAMPLE_STEP = h / 2;
  for (const prof of profiles || []) {
    const pl = (prof?.polyline || []).filter(
      (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
    );
    for (let i = 0; i < pl.length; i++) {
      pushExact(pl[i].x, pl[i].y, Number(pl[i].height) || 0);
      if (i < pl.length - 1) {
        const a = pl[i];
        const b = pl[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.floor(len / SAMPLE_STEP);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          pushExact(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t,
            (Number(a.height) || 0) +
              ((Number(b.height) || 0) - (Number(a.height) || 0)) * t
          );
        }
      }
    }
  }

  // Grid nodes too close to a profile line would create slivers against the
  // dense ridge samples (and could steal their Delaunay edges) — drop them
  // from the OUTPUT (they still served as Dirichlet constraints in the solve).
  const NEAR_PROFILE_2 = 0.55 * h * (0.55 * h);
  const gridOut = nodes.filter((nd) => nd.profD2 >= NEAR_PROFILE_2);

  return [
    ...exact,
    ...gridOut.map((nd) => ({ x: nd.x, y: nd.y, offsetTop: nd.value })),
  ];
}
