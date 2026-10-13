/**
 * Skeleton helpers shared by the OpenCV worker handlers (plain global
 * functions — the worker loads them with importScripts, see cv.worker.js).
 *
 * Masks are Uint8Array 0/1, row-major (idx = r * cols + c), with a 1-cell
 * zero margin on every side so the thinning never touches the border.
 *
 * zhangSuenThin / neighbors / pruneSpurs are a verbatim twin of the
 * ES-module versions in src/Features/geometry/utils/getPolygonMainAxisPolyline.js
 * (the worker cannot import modules) — keep both copies in sync.
 *
 * The rest implements the raster → vector steps of a classical centre-line
 * vectorization chain (F. Poux, "How to turn a 3D scan into a CAD floor
 * plan"): ordered chains by walking the skeleton graph, recursive
 * Ramer-Douglas-Peucker split, total-least-squares line fit.
 */

// Zhang-Suen thinning, in place. mask cells are 0/1; border cells stay 0.
function zhangSuenThin(mask, rows, cols) {
  const at = (r, c) => mask[r * cols + c];
  const toDelete = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      toDelete.length = 0;
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          if (!at(r, c)) continue;
          const p2 = at(r - 1, c);
          const p3 = at(r - 1, c + 1);
          const p4 = at(r, c + 1);
          const p5 = at(r + 1, c + 1);
          const p6 = at(r + 1, c);
          const p7 = at(r + 1, c - 1);
          const p8 = at(r, c - 1);
          const p9 = at(r - 1, c - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) a++;
          if (a !== 1) continue;
          const m1 = step === 0 ? p2 * p4 * p6 : p2 * p4 * p8;
          const m2 = step === 0 ? p4 * p6 * p8 : p2 * p6 * p8;
          if (m1 !== 0 || m2 !== 0) continue;
          toDelete.push(r * cols + c);
        }
      }
      if (toDelete.length) {
        changed = true;
        for (const idx of toDelete) mask[idx] = 0;
      }
    }
  }
}

/**
 * Staircase removal after Zhang-Suen. The thinning keeps both cells of a
 * diagonal step (its crossing-number test only walks the ring of
 * neighbours, so it never sees that the two neighbours across a corner
 * touch diagonally): oblique lines come out 2 cells wide in places, and
 * every such step is a spurious junction that chops the chain tracing
 * into fragments.
 *
 * A cell is removed when its foreground neighbours (8-adjacency among
 * themselves, not only along the ring) form a single connected group — so
 * local connectivity survives the removal — and it is not an end (≥ 2
 * neighbours). Removals are sequential (each one re-evaluated on the
 * current mask), which keeps the skeleton 8-connected. Junction centres
 * are kept: their neighbours form ≥ 2 groups.
 */
function removeStaircases(mask, rows, cols) {
  const offs = [-cols - 1, -cols, -cols + 1, -1, 1, cols - 1, cols, cols + 1];
  const nbrs = new Array(8);
  for (let pass = 0; pass < 4; pass++) {
    let removed = 0;
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const idx = r * cols + c;
        if (!mask[idx]) continue;
        let n = 0;
        for (let k = 0; k < 8; k++) {
          const j = idx + offs[k];
          if (mask[j]) nbrs[n++] = j;
        }
        if (n < 2) continue;
        // Components of the neighbour set under 8-adjacency (n ≤ 8: a
        // tiny union-find by repeated merging).
        const comp = new Array(n);
        for (let i = 0; i < n; i++) comp[i] = i;
        const find = (i) => {
          while (comp[i] !== i) i = comp[i];
          return i;
        };
        for (let i = 0; i < n; i++) {
          const ri = Math.floor(nbrs[i] / cols);
          const ci = nbrs[i] % cols;
          for (let j = i + 1; j < n; j++) {
            const rj = Math.floor(nbrs[j] / cols);
            const cj = nbrs[j] % cols;
            if (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1) {
              const a = find(i);
              const b = find(j);
              if (a !== b) comp[a] = b;
            }
          }
        }
        let groups = 0;
        for (let i = 0; i < n; i++) if (find(i) === i) groups++;
        if (groups !== 1) continue;
        mask[idx] = 0;
        removed++;
      }
    }
    if (!removed) break;
  }
}

function neighbors(idx, mask, rows, cols) {
  const r = Math.floor(idx / cols);
  const c = idx % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
      const j = rr * cols + cc;
      if (mask[j]) out.push(j);
    }
  }
  return out;
}

// Removes end branches shorter than `pruneLen` cells that end on a junction.
// A chain running from one endpoint to another is the whole skeleton and is
// never pruned.
function pruneSpurs(mask, rows, cols, pruneLen) {
  for (let pass = 0; pass < 5; pass++) {
    const endpoints = [];
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] && neighbors(i, mask, rows, cols).length === 1)
        endpoints.push(i);
    }
    let removed = false;
    for (const start of endpoints) {
      if (!mask[start]) continue;
      const chain = [start];
      let prev = -1;
      let cur = start;
      let endsOnJunction = false;
      while (chain.length <= pruneLen) {
        const ns = neighbors(cur, mask, rows, cols).filter((n) => n !== prev);
        if (ns.length === 0) break; // other endpoint: whole skeleton
        if (ns.length > 1) {
          endsOnJunction = true;
          break;
        }
        // A neighbour that is itself adjacent to the previous cell is part of
        // a thick corner, treat it as a junction-free step.
        prev = cur;
        cur = ns[0];
        if (neighbors(cur, mask, rows, cols).length > 2) {
          endsOnJunction = true;
          break;
        }
        chain.push(cur);
      }
      if (endsOnJunction && chain.length <= pruneLen) {
        for (const idx of chain) mask[idx] = 0;
        removed = true;
      }
    }
    if (!removed) break;
  }
}

/**
 * Walks a 1-cell-wide skeleton as a graph and returns its ordered chains.
 *
 * Every skeleton cell is a node, two cells are linked when they touch
 * (8-neighbourhood). A cell with two neighbours is the middle of a path,
 * one neighbour is an end, three or more a junction. The chains are the
 * paths between ends / junctions, each edge walked exactly once. A pure
 * loop (no end, no junction — a ring) is started from any of its cells.
 *
 * @returns {{ chains: number[][], nodes: number[], deg: Uint8Array }}
 *   chains as lists of cell indices (first / last cell = a node, or the
 *   loop seed), nodes = the cells of degree ≠ 2.
 */
function traceSkeletonChains(mask, rows, cols) {
  const n = rows * cols;
  const deg = new Uint8Array(n);
  const cells = [];
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    deg[i] = neighbors(i, mask, rows, cols).length;
    cells.push(i);
  }
  const nodes = cells.filter((i) => deg[i] !== 2);
  const seen = new Set();
  const edgeKey = (a, b) => (a < b ? a * n + b : b * n + a);

  const walk = (a, b) => {
    const chain = [a, b];
    let prev = a;
    let cur = b;
    while (deg[cur] === 2) {
      const ns = neighbors(cur, mask, rows, cols);
      let nxt;
      for (const q of ns) {
        if (q !== prev && !seen.has(edgeKey(cur, q))) {
          nxt = q;
          break;
        }
      }
      if (nxt === undefined) break;
      seen.add(edgeKey(cur, nxt));
      prev = cur;
      cur = nxt;
      chain.push(cur);
      if (cur === a) break;
    }
    return chain;
  };

  const chains = [];
  for (const a of nodes) {
    for (const b of neighbors(a, mask, rows, cols)) {
      const k = edgeKey(a, b);
      if (seen.has(k)) continue;
      seen.add(k);
      chains.push(walk(a, b));
    }
  }
  // Pure loops: every cell has degree 2, no node to start from.
  for (const c of cells) {
    if (deg[c] !== 2) continue;
    let b;
    for (const q of neighbors(c, mask, rows, cols)) {
      if (!seen.has(edgeKey(c, q))) {
        b = q;
        break;
      }
    }
    if (b === undefined) continue;
    seen.add(edgeKey(c, b));
    chains.push(walk(c, b));
  }
  return { chains, nodes, deg };
}

/**
 * Total least squares line through `points` ({x, y}): the line minimising
 * the perpendicular residuals (not the y residuals — a wall at 105° needs
 * the perpendicular error). 2D closed form: the direction is the major
 * eigenvector of the centred covariance, angle = ½·atan2(2·Sxy, Sxx − Syy).
 *
 * @returns {{ cx, cy, ux, uy, rms, n }} centroid, unit direction, RMS
 *   perpendicular residual, point count. Direction is (1, 0) for a single
 *   point / degenerate input.
 */
function fitLineTls(points) {
  const n = points.length;
  if (!n) return { cx: 0, cy: 0, ux: 1, uy: 0, rms: 0, n: 0 };
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  let ux = 1;
  let uy = 0;
  if (sxx + syy > 1e-9) {
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    ux = Math.cos(theta);
    uy = Math.sin(theta);
  }
  let sum2 = 0;
  for (const p of points) {
    const d = -(p.x - cx) * uy + (p.y - cy) * ux;
    sum2 += d * d;
  }
  return { cx, cy, ux, uy, rms: Math.sqrt(sum2 / n), n };
}

/**
 * Recursive Ramer-Douglas-Peucker split of an ordered chain: draws the
 * chord from the first to the last point, cuts at the point farthest from
 * it when that distance exceeds `tol`, recurses on both halves.
 *
 * Only decides WHERE to cut — the pieces are then fitted by fitLineTls (an
 * end cell is the noisiest cell of a chain, a bad place to put a wall).
 *
 * @returns {Array<[number, number]>} inclusive index ranges [i, j].
 */
function rdpSplit(points, tol) {
  const out = [];
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j - i < 2) {
      out.push([i, j]);
      continue;
    }
    const a = points[i];
    const b = points[j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    let k = -1;
    let best = -1;
    for (let m = i + 1; m < j; m++) {
      const p = points[m];
      const d =
        len < 1e-9
          ? Math.hypot(p.x - a.x, p.y - a.y)
          : Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
      if (d > best) {
        best = d;
        k = m;
      }
    }
    if (k < 0 || best <= tol) {
      out.push([i, j]);
      continue;
    }
    // Push right first so the left range pops first (output stays ordered).
    stack.push([k, j]);
    stack.push([i, k]);
  }
  return out;
}
