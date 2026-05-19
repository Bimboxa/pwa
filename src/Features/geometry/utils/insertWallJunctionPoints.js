// insertWallJunctionPoints
//
// T / L junction post-pass for the polyline-vectorisation walls (pixel space).
// Mutates the wall CENTERLINE polylines in place.
//
// Rule (decided with the user, see the 3-step diagram):
//   At a junction between two perpendicular walls, the LONGER wall is the
//   "through" wall: its end is EXTENDED so its body fully covers the corner
//   (it reaches past the far face of the shorter wall). The SHORTER wall is
//   the "abutting" wall: its end is moved (along its own axis, direction
//   preserved) so its tip penetrates the through wall by exactly
//   ENCASTREMENT_PX past the through wall's near face.
//
//   The two endpoints are intentionally NOT made coincident — the corner is
//   filled by the through wall's body, the abutting wall just reaches into it.
//
// Two junction shapes are handled:
//   - L: the two endpoints are near each other (corner). Through wall chosen
//        by length, then extended; abutting wall embedded 1 px.
//   - T: one endpoint lands on the BODY of another wall. That crossed wall is
//        the through wall (unchanged); the stem is embedded 1 px.
//
// Thresholds mirror the OpenCV auto-detection pass `_insertJunctionPoints`:
//   snapTol = max(5, round(maxThicknessPx * 0.75))
//   proximity gate: dist <= snapTol*2 ; max reach to intersection: snapTol*3

const ENCASTREMENT_PX = 1;

function classifyDir(dx, dy) {
  return Math.abs(dx) >= Math.abs(dy) ? "H" : "V";
}

function polylineLength(pl) {
  let L = 0;
  for (let i = 1; i < pl.length; i++) {
    L += Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y);
  }
  return L;
}

function unit(dx, dy) {
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return null;
  return { x: dx / L, y: dy / L };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

// Outward unit direction of the polyline's terminal segment at endpoint `ei`
// (0 = first point, 1 = last point): points from the wall body toward the
// endpoint.
function terminalDir(pl, ei) {
  if (ei === 0) return unit(pl[0].x - pl[1].x, pl[0].y - pl[1].y);
  const n = pl.length;
  return unit(pl[n - 1].x - pl[n - 2].x, pl[n - 1].y - pl[n - 2].y);
}

// Intersection of infinite line (p + t·d) and (q + s·e). Null if parallel.
function lineIntersection(p, d, q, e) {
  const denom = d.x * e.y - d.y * e.x;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / denom;
  return { x: p.x + t * d.x, y: p.y + t * d.y };
}

function projectOntoSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { x: ax, y: ay, t: 0, dist: Math.hypot(px - ax, py - ay) };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return { x: projX, y: projY, t, dist: Math.hypot(px - projX, py - projY) };
}

export default function insertWallJunctionPoints({ walls }) {
  if (!Array.isArray(walls) || walls.length < 2) return walls;

  const polylines = walls.map((w) => w.pointsPx);
  const thicknesses = walls.map((w) => w.thicknessPx || 0);
  const lengths = polylines.map(polylineLength);
  const maxThick = thicknesses.reduce((m, t) => Math.max(m, t || 0), 0) || 20;
  const snapTol = Math.max(5, Math.round(maxThick * 0.75));

  const done = new Set(); // `${wallIdx}_${ei}` endpoints already resolved

  // ── T junctions: an endpoint lands on the BODY of another wall ──────
  // The crossed wall is the through wall (left unchanged); the stem is
  // embedded ENCASTREMENT_PX past its near face along the stem's own axis.
  for (let i = 0; i < polylines.length; i++) {
    const plA = polylines[i];
    if (plA.length < 2) continue;
    for (let ei = 0; ei < 2; ei++) {
      const keyA = `${i}_${ei}`;
      if (done.has(keyA)) continue;
      const ep = ei === 0 ? plA[0] : plA[plA.length - 1];
      const uA = terminalDir(plA, ei);
      if (!uA) continue;

      let best = null;
      for (let j = 0; j < polylines.length; j++) {
        if (j === i) continue;
        const plB = polylines[j];
        if (plB.length < 2) continue;
        for (let k = 0; k < plB.length - 1; k++) {
          const a = plB[k];
          const b = plB[k + 1];
          const proj = projectOntoSegment(ep.x, ep.y, a.x, a.y, b.x, b.y);
          if (proj.dist > snapTol) continue;
          if (proj.t < 0.05 || proj.t > 0.95) continue; // near a B endpoint → L case
          const segDir = unit(b.x - a.x, b.y - a.y);
          if (
            !segDir ||
            classifyDir(segDir.x, segDir.y) === classifyDir(uA.x, uA.y)
          )
            continue; // need a perpendicular crossing
          if (!best || proj.dist < best.dist) {
            best = { j, proj, dist: proj.dist };
          }
        }
      }
      if (!best) continue;

      const halfB = (thicknesses[best.j] || 20) / 2;
      // proj is the foot on B's centerline; move back toward A's body so the
      // tip sits ENCASTREMENT_PX inside B's near face.
      const depth = Math.max(0, halfB - ENCASTREMENT_PX);
      ep.x = round1(best.proj.x - uA.x * depth);
      ep.y = round1(best.proj.y - uA.y * depth);
      done.add(keyA);
    }
  }

  // ── L junctions: two near, perpendicular endpoints ──────────────────
  for (let i = 0; i < polylines.length; i++) {
    const plA = polylines[i];
    if (plA.length < 2) continue;
    for (let ei = 0; ei < 2; ei++) {
      const keyA = `${i}_${ei}`;
      if (done.has(keyA)) continue;
      const epA = ei === 0 ? plA[0] : plA[plA.length - 1];
      const uA = terminalDir(plA, ei);
      if (!uA) continue;

      for (let j = i + 1; j < polylines.length; j++) {
        const plB = polylines[j];
        if (plB.length < 2) continue;
        for (let ej = 0; ej < 2; ej++) {
          const keyB = `${j}_${ej}`;
          if (done.has(keyB)) continue;
          const epB = ej === 0 ? plB[0] : plB[plB.length - 1];

          if (Math.hypot(epA.x - epB.x, epA.y - epB.y) > snapTol * 2) continue;

          const uB = terminalDir(plB, ej);
          if (!uB) continue;
          if (classifyDir(uA.x, uA.y) === classifyDir(uB.x, uB.y)) continue; // need orthogonal

          const X = lineIntersection(epA, uA, epB, uB);
          if (!X) continue;
          if (Math.hypot(X.x - epA.x, X.y - epA.y) > snapTol * 3) continue;
          if (Math.hypot(X.x - epB.x, X.y - epB.y) > snapTol * 3) continue;

          const halfA = (thicknesses[i] || 20) / 2;
          const halfB = (thicknesses[j] || 20) / 2;

          // Longer wall = through (extended to cover the corner past the
          // shorter wall's far face). Shorter wall = abutting (embedded
          // ENCASTREMENT_PX past the through wall's near face).
          let through, abut;
          if (lengths[i] >= lengths[j]) {
            through = { ep: epA, u: uA, otherHalf: halfB };
            abut = { ep: epB, u: uB, throughHalf: halfA };
          } else {
            through = { ep: epB, u: uB, otherHalf: halfA };
            abut = { ep: epA, u: uA, throughHalf: halfB };
          }

          // Through: tip at X extended outward by the abutting wall's
          // half-thickness → its body spans the full corner.
          through.ep.x = round1(X.x + through.u.x * through.otherHalf);
          through.ep.y = round1(X.y + through.u.y * through.otherHalf);

          // Abutting: tip ENCASTREMENT_PX past the through wall's near face,
          // along its own axis (anchor = its other end → direction kept).
          const depth = Math.max(0, abut.throughHalf - ENCASTREMENT_PX);
          abut.ep.x = round1(X.x - abut.u.x * depth);
          abut.ep.y = round1(X.y - abut.u.y * depth);

          done.add(keyA);
          done.add(keyB);
          break;
        }
        if (done.has(keyA)) break;
      }
    }
  }

  // ── Remove consecutive duplicate points (never drop below 2) ────────
  for (const pl of polylines) {
    for (let k = pl.length - 1; k > 0 && pl.length > 2; k--) {
      if (
        Math.abs(pl[k].x - pl[k - 1].x) < 1 &&
        Math.abs(pl[k].y - pl[k - 1].y) < 1
      ) {
        pl.splice(k, 1);
      }
    }
  }

  return walls;
}
