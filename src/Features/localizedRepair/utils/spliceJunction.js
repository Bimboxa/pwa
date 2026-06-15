// Direct L/T junction repair between two closed outline rings — NO polygon
// boolean union.
//
// Idea (per the spec): the "abutting" wall has a tip edge (the short end facing
// the other wall); the "through" wall has the edge that tip should reach. We
//   1. pick the abut tip edge + parallel through face edge with the smallest gap,
//   2. project the two tip endpoints onto the through edge's line,
//   3. splice the abut outline (minus its tip edge) into the through outline
//      between the two projected points — which removes the small segment of the
//      through edge between them (the junction opening).
//
// Both rings are arrays of {x,y} (closed, no repeated closing point). Returns the
// merged ring [{x,y}] or null when no valid junction is found.

function unitDir(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return { x: dx / len, y: dy / len };
}

// Project p onto the infinite line through c→d. Returns param t (0 at c, 1 at d),
// the projected point, and the perpendicular distance.
function projectOnLine(p, c, d) {
  const dx = d.x - c.x;
  const dy = d.y - c.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-9) return null;
  const t = ((p.x - c.x) * dx + (p.y - c.y) * dy) / l2;
  const proj = { x: c.x + t * dx, y: c.y + t * dy };
  return { t, proj, dist: Math.hypot(p.x - proj.x, p.y - proj.y) };
}

const PARALLEL_DOT = 0.96; // ~16° tolerance
const FACE_EXTENT = 0.3; // allow tip projections slightly past the face ends (L)

export default function spliceJunction(through, abut, { maxGap } = {}) {
  const nT = through.length;
  const nA = abut.length;
  if (nT < 3 || nA < 3) return null;

  // Find the abut tip edge + parallel through face edge with the smallest gap.
  let best = null;
  for (let i = 0; i < nA; i++) {
    const j = (i + 1) % nA;
    const eDir = unitDir(abut[i], abut[j]);
    if (!eDir) continue;
    for (let p = 0; p < nT; p++) {
      const q = (p + 1) % nT;
      const c = through[p];
      const d = through[q];
      const fDir = unitDir(c, d);
      if (!fDir) continue;
      if (Math.abs(eDir.x * fDir.x + eDir.y * fDir.y) < PARALLEL_DOT) continue;
      const pr1 = projectOnLine(abut[i], c, d);
      const pr2 = projectOnLine(abut[j], c, d);
      if (!pr1 || !pr2) continue;
      if (pr1.t < -FACE_EXTENT || pr1.t > 1 + FACE_EXTENT) continue;
      if (pr2.t < -FACE_EXTENT || pr2.t > 1 + FACE_EXTENT) continue;
      const gap = (pr1.dist + pr2.dist) / 2;
      if (!best || gap < best.gap) best = { gap, i, j, p, pr1, pr2 };
    }
  }
  if (!best) return null;
  if (maxGap != null && best.gap > maxGap) return null;

  // Abut outline minus its tip edge: walk from tip i the long way around to tip j.
  const farIdx = [];
  let k = best.i;
  for (;;) {
    farIdx.push(k);
    if (k === best.j) break;
    k = (k - 1 + nA) % nA;
  }
  const middleIdx = farIdx.slice(1, -1); // abut vertices between the two tips
  const projI = best.pr1.proj;
  const projJ = best.pr2.proj;

  // Order the spliced sequence along the face edge (c→d), from the projection
  // nearest c to the one nearest d.
  let seq;
  if (best.pr1.t <= best.pr2.t) {
    seq = [
      projI,
      ...middleIdx.map((ix) => ({ x: abut[ix].x, y: abut[ix].y })),
      projJ,
    ];
  } else {
    seq = [
      projJ,
      ...middleIdx
        .slice()
        .reverse()
        .map((ix) => ({ x: abut[ix].x, y: abut[ix].y })),
      projI,
    ];
  }

  // Insert the sequence into the through ring at the face edge — this drops the
  // small piece of the through edge between the two projected points.
  const merged = [];
  for (let m = 0; m < nT; m++) {
    merged.push({ x: through[m].x, y: through[m].y });
    if (m === best.p) {
      for (const s of seq) merged.push({ x: s.x, y: s.y });
    }
  }
  return merged;
}
