import { readPixel, sameColor } from "./detectWallHoverCandidate.js";

// Structural band detection in an oriented frame: `a` runs along the copied
// direction, `t` across it. A wall is a pair of parallel faces at the copied
// spacing, whatever lies outside (white paper, a colored fill, a darker
// surface). All coordinates are bitmap pixels relative to the grid origin.
const UNKNOWN = 0,
  NEUTRAL = 1,
  FOREIGN = 2;
const EDGE_MIN = 0.1;

// Sizes are real-world lengths: a plan at 6 cm per pixel and one at 3 mm per
// pixel must behave alike. Pixels only bound them from below, where the
// raster cannot resolve less. `metersPerPx` is the size of one bitmap pixel.
export function createTolerances(metersPerPx, width) {
  const px = (meters, floor = 1) => Math.max(floor, meters / metersPerPx);
  return {
    px,
    // Thickest outline still located as a single face (never a wide part of
    // the band itself).
    outline: Math.max(1, Math.min(px(0.045), width / 4)),
    // Thickest colored line looked through (dimension, axis).
    coloredLine: Math.round(px(0.03)),
    // How far a face may sit from its expected position.
    reach: px(0.03),
    // Depth read outside a face to describe the exterior.
    exterior: Math.round(px(0.06, 3)),
  };
}

// null: outside the image, under the exclusion mask or inside the source
// footprint. `foreign` flags a saturated color that is not the wall material.
// `excludeSource: false` reads the copy itself (its pixel signature).
export function createProbe(
  imageData,
  exclusionMask,
  model,
  { excludeSource = true } = {}
) {
  return (x, y) => {
    const px = Math.floor(x),
      py = Math.floor(y);
    if (
      px < 0 ||
      py < 0 ||
      px >= imageData.width ||
      py >= imageData.height ||
      exclusionMask?.[py * imageData.width + px]
    )
      return null;
    const dx = x - model.center.x,
      dy = y - model.center.y;
    if (
      excludeSource &&
      Math.abs(dx * model.u.x + dy * model.u.y) <= model.length / 2 &&
      Math.abs(dx * model.n.x + dy * model.n.y) <= model.width / 2
    )
      return null;
    const pixel = readPixel(imageData, x, y);
    return {
      gray: pixel.gray,
      foreign: !!pixel.color && !sameColor(pixel.color, model.materialColor),
    };
  };
}

// Rows are axial samples `aMin + i * aStep`, columns are integer transverse
// offsets `tMin..tMax`. The origin should sit on a pixel center so that
// axis-aligned walls map one column to exactly one pixel column.
export function buildOrientedGrid(
  probe,
  origin,
  u,
  n,
  { aMin, aMax, aStep = 1, tMin, tMax },
  tol
) {
  const cols = tMax - tMin + 1,
    rows = Math.floor((aMax - aMin) / aStep) + 1;
  const gray = new Float32Array(cols * rows),
    kind = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const a = aMin + r * aStep;
    for (let c = 0; c < cols; c++) {
      const t = tMin + c;
      const value = probe(
        origin.x + a * u.x + t * n.x,
        origin.y + a * u.y + t * n.y
      );
      if (!value) continue;
      gray[r * cols + c] = value.gray;
      kind[r * cols + c] = value.foreign ? FOREIGN : NEUTRAL;
    }
  }
  return { gray, kind, cols, rows, aMin, aStep, tMin, tol };
}

// Axial statistics of each column over rows [r0, r1]. Averaging along the
// axis removes hatch phase and crossing dimensions; what remains is the
// transverse structure of the band.
export function columnStats(grid, r0 = 0, r1 = grid.rows - 1) {
  r0 = Math.max(0, r0);
  r1 = Math.min(grid.rows - 1, r1);
  const total = r1 - r0 + 1;
  const stats = [];
  for (let c = 0; c < grid.cols; c++) {
    let known = 0,
      foreign = 0,
      all = 0,
      sum = 0,
      squares = 0;
    for (let r = r0; r <= r1; r++) {
      const k = grid.kind[r * grid.cols + c];
      if (!k) continue;
      known++;
      const g = grid.gray[r * grid.cols + c];
      all += g;
      if (k === FOREIGN) {
        foreign++;
        continue;
      }
      sum += g;
      squares += g * g;
    }
    stats.push(describeColumn(total, known, foreign, all, sum, squares));
  }
  return lookThroughColoredLines(stats, grid.tol);
}

function describeColumn(total, known, foreign, all, sum, squares) {
  const count = known - foreign;
  // `gray` (every known pixel) only orders two columns: darker or lighter.
  if (total < 1 || known < total * 0.5) return { kind: UNKNOWN };
  if (foreign > known * 0.6 || !count)
    return { kind: FOREIGN, gray: all / known };
  const mean = sum / count;
  return {
    kind: NEUTRAL,
    gray: all / known,
    mean,
    dev: Math.sqrt(Math.max(0, squares / count - mean * mean)),
  };
}

// A thin colored line running along the axis is a dimension or an axis, not
// a surface: look through it.
function lookThroughColoredLines(stats, tol) {
  for (let c = 1; c < stats.length - 1; c++) {
    if (stats[c].kind !== FOREIGN || stats[c - 1].kind !== NEUTRAL) continue;
    let end = c;
    while (end < stats.length && stats[end].kind === FOREIGN) end++;
    if (end - c <= tol.coloredLine && stats[end]?.kind === NEUTRAL)
      for (let i = c; i < end; i++) stats[i] = stats[c - 1];
    c = end;
  }
  return stats;
}

// columnStats for many row ranges of the same grid: summed tables along the
// rows make each range cost one pass over the columns.
export function createRangeStats(grid) {
  const { cols, rows } = grid;
  const size = (rows + 1) * cols;
  const known = new Int32Array(size),
    foreign = new Int32Array(size),
    all = new Float64Array(size),
    sum = new Float64Array(size),
    squares = new Float64Array(size);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const from = r * cols + c,
        to = from + cols;
      const k = grid.kind[from],
        g = grid.gray[from];
      known[to] = known[from] + (k ? 1 : 0);
      foreign[to] = foreign[from] + (k === FOREIGN ? 1 : 0);
      all[to] = all[from] + (k ? g : 0);
      sum[to] = sum[from] + (k === NEUTRAL ? g : 0);
      squares[to] = squares[from] + (k === NEUTRAL ? g * g : 0);
    }
  return (r0, r1) => {
    const lo = Math.max(0, r0) * cols,
      hi = (Math.min(rows - 1, r1) + 1) * cols;
    const stats = [];
    for (let c = 0; c < cols; c++)
      stats.push(
        describeColumn(
          r1 - r0 + 1,
          known[hi + c] - known[lo + c],
          foreign[hi + c] - foreign[lo + c],
          all[hi + c] - all[lo + c],
          sum[hi + c] - sum[lo + c],
          squares[hi + c] - squares[lo + c]
        )
      );
    return lookThroughColoredLines(stats, grid.tol);
  };
}

// Each column replaced by the statistics of the `size` columns around it.
// A profile read along a hatched band ripples with the hatch pitch; pooled
// over about a pitch it only keeps what changes along the band.
export function poolStats(stats, size) {
  const half = Math.floor(size / 2);
  return stats.map((_, c) => {
    let known = 0,
      foreign = 0,
      all = 0,
      sum = 0,
      squares = 0,
      total = 0;
    for (
      let i = Math.max(0, c - half);
      i <= Math.min(stats.length - 1, c + half);
      i++
    ) {
      total++;
      const column = stats[i];
      if (column.kind === UNKNOWN) continue;
      known++;
      all += column.gray;
      if (column.kind === FOREIGN) {
        foreign++;
        continue;
      }
      sum += column.mean;
      squares += column.dev * column.dev + column.mean * column.mean;
    }
    return describeColumn(total, known, foreign, all, sum, squares);
  });
}

function difference(p, q) {
  if (p.kind === UNKNOWN || q.kind === UNKNOWN) return NaN;
  if (p.kind !== q.kind) return 1;
  if (p.kind === FOREIGN) return 0;
  return Math.abs(p.mean - q.mean) + 0.5 * Math.abs(p.dev - q.dev);
}

// Mean column-to-column difference between two profiles of the same columns
// (for example the faces and interior of a band at two places along its
// axis). `reference[i]` is compared with `observed[offset + i]`, every
// `stride` columns; differences up to `noise` count for nothing. null when
// too few columns are known on both sides.
export function profileDistance(
  reference,
  observed,
  offset = 0,
  stride = 1,
  noise = 0
) {
  let sum = 0,
    count = 0,
    total = 0;
  for (let c = 0; c < reference.length; c += stride) {
    total++;
    const other = observed[offset + c];
    if (!other) continue;
    const d = difference(reference[c], other);
    if (!Number.isFinite(d)) continue;
    sum += Math.max(0, d - noise);
    count++;
  }
  return count < total * 0.5 ? null : sum / count;
}

// Faces are built from signed column transitions (towards darker or towards
// lighter). Adjacent transitions of the same sign are one antialiased step,
// located at its weighted centroid. A step to darker closely followed by a
// step to lighter is a thin outline, located at its center. Anything wider
// than an outline stays two faces: a thin filled band is not a line, and a
// second line beside an outline is not part of it.
export function findFaces(stats, tMin, tol) {
  const steps = [];
  for (let b = 1; b < stats.length; b++) {
    const d = difference(stats[b - 1], stats[b]);
    if (!(d >= EDGE_MIN)) continue;
    const sign = stats[b].gray < stats[b - 1].gray ? -1 : 1;
    const last = steps.at(-1);
    if (last?.hi === b - 1 && last.sign === sign) {
      last.moment += d * (tMin + b - 0.5);
      last.strength += d;
      last.hi = b;
    } else
      steps.push({
        moment: d * (tMin + b - 0.5),
        strength: d,
        sign,
        lo: b,
        hi: b,
      });
  }
  const faces = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i],
      next = steps[i + 1];
    const t = step.moment / step.strength;
    if (
      step.sign < 0 &&
      next?.sign > 0 &&
      next.moment / next.strength - t <= tol.outline &&
      // Hatch noise beside an outline is not its other side.
      Math.min(step.strength, next.strength) >=
        Math.max(step.strength, next.strength) * 0.35
    ) {
      faces.push({
        t: (step.moment + next.moment) / (step.strength + next.strength),
        strength: Math.max(step.strength, next.strength),
        lo: step.lo,
        hi: next.hi,
      });
      i++;
    } else faces.push({ t, strength: step.strength, lo: step.lo, hi: step.hi });
  }
  return faces;
}

// Fraction of axial chunks in which the face is as visible as in its best
// chunk. A real face runs along the whole window; a label, a crossing line
// or a band ending inside the window does not.
export function faceSupport(grid, face, r0, r1, chunks) {
  const edges = [];
  const size = (r1 - r0 + 1) / chunks;
  for (let k = 0; k < chunks; k++) {
    const stats = columnStats(
      grid,
      Math.round(r0 + k * size),
      Math.round(r0 + (k + 1) * size) - 1
    );
    let best = NaN;
    for (
      let b = Math.max(1, face.lo - 1);
      b <= Math.min(stats.length - 1, face.hi + 1);
      b++
    ) {
      const d = difference(stats[b - 1], stats[b]);
      if (Number.isFinite(d) && !(d <= best)) best = d;
    }
    if (Number.isFinite(best)) edges.push(best);
  }
  const threshold = Math.max(EDGE_MIN * 0.8, Math.max(...edges) * 0.5);
  return {
    ratio: edges.length
      ? edges.filter((d) => d >= threshold).length / edges.length
      : 0,
    known: edges.length / chunks,
  };
}

function aggregate(stats, from, to) {
  let neutral = 0,
    foreign = 0,
    unknown = 0,
    mean = 0,
    dev = 0;
  for (let c = Math.max(0, from); c <= Math.min(stats.length - 1, to); c++) {
    const s = stats[c];
    if (s.kind === UNKNOWN) unknown++;
    else if (s.kind === FOREIGN) foreign++;
    else {
      neutral++;
      mean += s.mean;
      dev += s.dev;
    }
  }
  const known = neutral + foreign;
  if (!known) return { known: 0, unknown };
  return foreign > neutral
    ? { kind: FOREIGN, known, unknown }
    : {
        kind: NEUTRAL,
        mean: mean / neutral,
        dev: dev / neutral,
        known,
        unknown,
      };
}

function differs(a, b) {
  if (!a.known || !b.known) return false;
  if (a.kind !== b.kind) return true;
  if (a.kind === FOREIGN) return false;
  return Math.abs(a.mean - b.mean) > 0.06 || Math.abs(a.dev - b.dev) > 0.05;
}

// Interior description between two transverse positions (core only).
export function describeInterior(stats, tMin, tLo, tHi) {
  const inset = (tHi - tLo) * 0.2;
  return aggregate(
    stats,
    Math.ceil(tLo + inset - tMin),
    Math.floor(tHi - inset - tMin)
  );
}

// Pairs of supported faces at the copied spacing. `body` tells a filled wall
// (a non-blank interior unlike at least one exterior) from bare lines; an interior
// hidden by the exclusion mask is an already annotated wall and is skipped.
export function findBands(grid, stats, faces, r0, r1, width, tolerance) {
  const { reach, exterior } = grid.tol;
  const chunks = Math.max(2, Math.min(4, Math.floor((r1 - r0 + 1) / 6)));
  const supportOf = (face) =>
    (face.support ??= faceSupport(grid, face, r0, r1, chunks));
  const bands = [];
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++) {
      const left = faces[i],
        right = faces[j];
      const span = right.t - left.t;
      if (span < width - tolerance) continue;
      if (span > width + tolerance) break;
      if (supportOf(left).ratio < 0.6 || supportOf(right).ratio < 0.6) continue;
      // A wall is bounded by its most prominent edges. One inner face as
      // strong as those is an axis drawn through it; several are a grid or
      // a hatch pitch, not a wall.
      const weakest = Math.min(left.strength, right.strength);
      const inner = faces.filter(
        (face) =>
          face.t > left.t + reach &&
          face.t < right.t - reach &&
          face.strength >= weakest * 0.8
      ).length;
      if (inner > 1) continue;
      const interior = describeInterior(stats, grid.tMin, left.t, right.t);
      if (!interior.known || interior.unknown > interior.known * 0.4) continue;
      // Blank paper between two lines is the gap beside a wall as often as
      // a wall drawn without fill: never rank it as a filled body.
      const blank =
        interior.kind === NEUTRAL &&
        interior.mean > 0.96 &&
        interior.dev < 0.03;
      const body =
        !blank &&
        (differs(interior, aggregate(stats, left.lo - exterior, left.lo - 1)) ||
          differs(
            interior,
            aggregate(stats, right.hi, right.hi + exterior - 1)
          ));
      bands.push({
        t: (left.t + right.t) / 2,
        span,
        strength: weakest,
        body,
        inner,
        interior,
      });
    }
  // Overlapping pairs describe the same wall (outline inner / outer edges,
  // hatch noise): keep the best supported one.
  bands.sort((a, b) => b.strength - a.strength);
  return bands.filter(
    (band, i) =>
      !bands.slice(0, i).some((other) => Math.abs(other.t - band.t) < width / 2)
  );
}

// One readable face whose opposite side is hidden (existing annotation, image
// border): the band is assumed on the side where the copied width ends in
// the unknown. The caller must still confirm the material.
export function findOneFaceBands(grid, stats, faces, r0, r1, width) {
  const chunks = Math.max(2, Math.min(4, Math.floor((r1 - r0 + 1) / 6)));
  const bands = [];
  for (const face of faces) {
    for (const sign of [-1, 1]) {
      const far = Math.round(face.t + sign * width - grid.tMin);
      const around = Math.ceil(grid.tol.reach);
      const beyond = aggregate(stats, far - around, far + around);
      if (beyond.known > beyond.unknown) continue;
      const interior = describeInterior(
        stats,
        grid.tMin,
        Math.min(face.t, face.t + sign * width),
        Math.max(face.t, face.t + sign * width)
      );
      if (!interior.known || interior.unknown > interior.known * 0.4) continue;
      face.support ??= faceSupport(grid, face, r0, r1, chunks);
      if (face.support.ratio < 0.6) continue;
      bands.push({
        t: face.t + (sign * width) / 2,
        span: width,
        strength: face.strength,
        body: true,
        interior,
      });
    }
  }
  return bands;
}

// Faces of an acquired band measured again on another grid (for example the
// whole extended span). Returns the lateral correction to its center.
export function measureBandFaces(grid, center, span, tolerance) {
  const stats = columnStats(grid);
  const faces = findFaces(stats, grid.tMin, grid.tol);
  const chunks = Math.max(2, Math.min(8, Math.floor(grid.rows / 6)));
  const nearest = (target) => {
    let best = null;
    for (const face of faces) {
      const distance = Math.abs(face.t - target);
      if (distance > tolerance) continue;
      if (
        !best ||
        face.strength - distance * 0.1 > best.strength - best.distance * 0.1
      )
        best = { ...face, distance };
    }
    if (best)
      best.support = faceSupport(grid, best, 0, grid.rows - 1, chunks).ratio;
    return best;
  };
  const left = nearest(center - span / 2),
    right = nearest(center + span / 2);
  const around = Math.ceil(grid.tol.reach);
  const hidden = (target) => {
    const side = aggregate(
      stats,
      Math.round(target - grid.tMin) - around,
      Math.round(target - grid.tMin) + around
    );
    return side.unknown > side.known;
  };
  return {
    left,
    right,
    leftHidden: !left && hidden(center - span / 2),
    rightHidden: !right && hidden(center + span / 2),
    shift:
      left?.support >= 0.5 && right?.support >= 0.5
        ? (left.t + right.t) / 2 - center
        : 0,
  };
}

// Are the faces of an acquired band visible on rows [aMin, aMax]? Per side:
// the face strength found there, false, or null when that side is hidden.
// `origin` must be pixel-centered; `center` is the band center relative to
// it. The window must span a hatch period: single rows show every hatch
// stroke as a face.
export function bandFacesPresent(
  probe,
  origin,
  u,
  n,
  { aMin, aMax, center, span, minStrength },
  tol
) {
  const reach = Math.ceil(tol.reach);
  const half = Math.ceil(span / 2 + tol.exterior + reach + 2);
  const grid = buildOrientedGrid(
    probe,
    origin,
    u,
    n,
    { aMin, aMax, tMin: -half, tMax: half },
    tol
  );
  const stats = columnStats(grid);
  const faces = findFaces(stats, grid.tMin, tol);
  const side = (target) => {
    const strength = Math.max(
      0,
      ...faces
        .filter((face) => Math.abs(face.t - target) <= tol.reach)
        .map((face) => face.strength)
    );
    if (strength >= minStrength) return strength;
    const around = aggregate(
      stats,
      Math.round(target - grid.tMin) - reach,
      Math.round(target - grid.tMin) + reach
    );
    return around.unknown > around.known ? null : false;
  };
  return { left: side(center - span / 2), right: side(center + span / 2) };
}

// Scanline classifier for bands without a usable material (two bare lines,
// a foreign-colored interior): the band continues while its faces do.
// Same vocabulary as createSectionClassifier in detectWallHoverCandidate.
export function createFaceSectionClassifier(
  probe,
  candidate,
  span,
  interior,
  tol
) {
  const at = (a, t) =>
    probe(
      candidate.center.x + a * candidate.u.x + t * candidate.n.x,
      candidate.center.y + a * candidate.u.y + t * candidate.n.y
    );
  const reach = Math.ceil(tol.reach) + 1;
  const faceAt = (a, target) => {
    let previous = null,
      unknown = 0,
      best = 0;
    for (let t = target - reach; t <= target + reach; t++) {
      const value = at(a, t);
      if (!value) {
        unknown++;
        previous = null;
        continue;
      }
      if (previous)
        best = Math.max(
          best,
          previous.foreign !== value.foreign
            ? 1
            : value.foreign
              ? 0
              : Math.abs(previous.gray - value.gray)
        );
      previous = value;
    }
    return unknown > reach ? null : best >= 0.25;
  };
  const samples = Math.max(5, Math.min(40, Math.ceil(span * 0.6)));
  return (a) => {
    let sum = 0,
      neutral = 0,
      foreign = 0,
      unknown = 0;
    for (let i = 0; i < samples; i++) {
      const value = at(a, ((i + 0.5) / samples - 0.5) * span * 0.6);
      if (!value) unknown++;
      else if (value.foreign) foreign++;
      else {
        neutral++;
        sum += value.gray;
      }
    }
    if (unknown > samples * 0.3) return null;
    const left = faceAt(a, -span / 2),
      right = faceAt(a, span / 2);
    if (interior.kind === FOREIGN) {
      if (foreign < (neutral + foreign) * 0.5) return false;
    } else {
      if (foreign > (neutral + foreign) * 0.3) return "occluded";
      // A transverse line or another material replaces the interior.
      if (sum / neutral < interior.mean - 0.15) return "ink";
      if (Math.abs(sum / neutral - interior.mean) > 0.15) return false;
    }
    if (left === false && right === false) return false;
    // One face missing: a junction with a perpendicular band. Tolerated like
    // an occlusion; the endpoint only moves again when both faces resume.
    if (left === false || right === false) return "occluded";
    return true;
  };
}
