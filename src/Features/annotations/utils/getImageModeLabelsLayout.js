/**
 * Display-only label layout for the "Export rapide" (imageMode) capture.
 *
 * Two modes:
 * - "ANTI_OVERLAP": labels stay near their current position; overlapping
 *   chips are pushed apart pairwise until no pair overlaps.
 * - "MARGIN_BAND": labels are packed in a band `margin` px inside the
 *   capture rect border, on the edge nearest to their target, sorted by
 *   target position so leader lines never cross (same strategy as
 *   getAutoLayoutLabels, but relative to the capture rect and with
 *   per-item chip sizes).
 *
 * All coordinates and sizes are in IMAGE-PIXEL space (the caller converts
 * screen px with 1 / (cameraK * basePoseK)). Targets never move: only
 * labelPoint (the chip center) is recomputed.
 *
 * @param {Object} params
 * @param {Array} params.items - [{ id, targetPoint:{x,y}, labelPoint:{x,y}, width, height }]
 * @param {Object|null} params.captureRect - { x0, y0, x1, y1 } (required for MARGIN_BAND;
 *   optional clamp bounds for ANTI_OVERLAP)
 * @param {"ANTI_OVERLAP"|"MARGIN_BAND"} params.mode
 * @param {number} params.margin - band inset from the capture rect border
 * @param {number} params.gap - minimal spacing between chips
 * @returns {Object} { [id]: { labelPoint: {x,y} } } - only moved labels
 */

// Pairwise separation converges much faster with a slight overshoot (pairs
// pushed a bit further apart than the strict overlap), and needs a small
// epsilon so residual sub-pixel overlaps don't keep the loop running.
const MAX_ITERATIONS = 200;
const PUSH_OVERSHOOT = 1.5;

export default function getImageModeLabelsLayout({
  items,
  captureRect = null,
  mode = "ANTI_OVERLAP",
  margin = 0,
  gap = 0,
}) {
  if (!Array.isArray(items) || items.length === 0) return {};

  const valid = items.filter(
    (it) =>
      it &&
      it.id != null &&
      it.targetPoint &&
      it.labelPoint &&
      Number.isFinite(it.width) &&
      Number.isFinite(it.height) &&
      it.width > 0 &&
      it.height > 0
  );
  if (valid.length === 0) return {};

  const placed =
    mode === "MARGIN_BAND" && captureRect
      ? solveMarginBand(valid, captureRect, margin, gap)
      : solveAntiOverlap(valid, captureRect, gap);

  // Only report labels that actually moved.
  const overrides = {};
  placed.forEach(({ item, x, y }) => {
    const moved =
      Math.abs(x - item.labelPoint.x) > 1e-6 ||
      Math.abs(y - item.labelPoint.y) > 1e-6;
    if (moved) overrides[item.id] = { labelPoint: { x, y } };
  });
  return overrides;
}

// --- MODE A: pairwise separation -----------------------------------------

function solveAntiOverlap(items, captureRect, gap) {
  // Deterministic order regardless of input order.
  const sorted = [...items].sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );

  const nodes = sorted.map((item) => ({
    item,
    x: item.labelPoint.x,
    y: item.labelPoint.y,
  }));

  // Sub-pixel overlaps are invisible: stop pushing below this threshold so
  // the loop terminates instead of jittering forever.
  const epsilon = Math.max(gap, 1) / 1000;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let movedAny = false;

    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        // Half extents padded by the gap.
        const hw = (a.item.width + b.item.width) / 2 + gap;
        const hh = (a.item.height + b.item.height) / 2 + gap;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = hw - Math.abs(dx);
        const oy = hh - Math.abs(dy);
        if (ox <= epsilon || oy <= epsilon) continue; // no (visible) overlap

        movedAny = true;
        // Push apart along the axis of least overlap, half each side.
        if (ox < oy) {
          const dir = dx >= 0 ? 1 : -1;
          const push = (ox / 2) * PUSH_OVERSHOOT * dir;
          a.x -= push;
          b.x += push;
        } else {
          const dir = dy >= 0 ? 1 : -1;
          const push = (oy / 2) * PUSH_OVERSHOOT * dir;
          a.y -= push;
          b.y += push;
        }
      }
    }

    if (!movedAny) break;
  }

  if (captureRect) {
    nodes.forEach((n) => {
      n.x = clamp(
        n.x,
        captureRect.x0 + n.item.width / 2,
        captureRect.x1 - n.item.width / 2
      );
      n.y = clamp(
        n.y,
        captureRect.y0 + n.item.height / 2,
        captureRect.y1 - n.item.height / 2
      );
    });
  }

  return nodes;
}

// --- MODE B: margin band around the capture rect --------------------------

function solveMarginBand(items, captureRect, margin, gap) {
  const { x0, y0, x1, y1 } = captureRect;

  const inside = [];
  const outside = [];
  items.forEach((item) => {
    const { x, y } = item.targetPoint;
    const isInside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
    (isInside ? inside : outside).push(item);
  });

  // Corner reserve: keep bands away from the rect corners so adjacent
  // edges never collide.
  const maxSize = inside.reduce((m, it) => Math.max(m, it.width, it.height), 0);
  const reserve = margin + maxSize + gap;

  const groups = { top: [], bottom: [], left: [], right: [] };
  inside.forEach((item) => {
    const { x, y } = item.targetPoint;
    const dTop = y - y0;
    const dBottom = y1 - y;
    const dLeft = x - x0;
    const dRight = x1 - x;
    const min = Math.min(dTop, dBottom, dLeft, dRight);
    if (min === dTop) groups.top.push(item);
    else if (min === dBottom) groups.bottom.push(item);
    else if (min === dLeft) groups.left.push(item);
    else groups.right.push(item);
  });

  const placed = [];

  // LEFT / RIGHT: distribute along y, pin x.
  placed.push(
    ...solveBand1D(groups.left, {
      getTarget: (p) => p.y,
      getSize: (it) => it.height,
      rangeStart: y0 + reserve,
      rangeEnd: y1 - reserve,
      gap,
      toPoint: (item, v) => ({ item, x: x0 + margin + item.width / 2, y: v }),
    }),
    ...solveBand1D(groups.right, {
      getTarget: (p) => p.y,
      getSize: (it) => it.height,
      rangeStart: y0 + reserve,
      rangeEnd: y1 - reserve,
      gap,
      toPoint: (item, v) => ({ item, x: x1 - margin - item.width / 2, y: v }),
    }),
    // TOP / BOTTOM: distribute along x, pin y.
    ...solveBand1D(groups.top, {
      getTarget: (p) => p.x,
      getSize: (it) => it.width,
      rangeStart: x0 + reserve,
      rangeEnd: x1 - reserve,
      gap,
      toPoint: (item, v) => ({ item, x: v, y: y0 + margin + item.height / 2 }),
    }),
    ...solveBand1D(groups.bottom, {
      getTarget: (p) => p.x,
      getSize: (it) => it.width,
      rangeStart: x0 + reserve,
      rangeEnd: x1 - reserve,
      gap,
      toPoint: (item, v) => ({ item, x: v, y: y1 - margin - item.height / 2 }),
    })
  );

  // Targets outside the capture rect: cropped anyway, keep as-is.
  outside.forEach((item) =>
    placed.push({ item, x: item.labelPoint.x, y: item.labelPoint.y })
  );

  return placed;
}

/**
 * 1D placement along one edge: sort by target (no leader crossings),
 * center each chip on its target, push-forward on overlap, pull-back
 * recentering, then clamp to the band range (even distribution fallback
 * when the band overflows).
 */
function solveBand1D(
  items,
  { getTarget, getSize, rangeStart, rangeEnd, gap, toPoint }
) {
  if (items.length === 0) return [];

  const sorted = [...items].sort(
    (a, b) => getTarget(a.targetPoint) - getTarget(b.targetPoint)
  );

  const slots = sorted.map((item) => {
    const center = getTarget(item.targetPoint);
    const size = getSize(item);
    return { item, size, start: center - size / 2, end: center + size / 2 };
  });

  // Push forward.
  for (let i = 0; i < slots.length - 1; i++) {
    const current = slots[i];
    const next = slots[i + 1];
    const overlap = current.end + gap - next.start;
    if (overlap > 0) {
      next.start += overlap;
      next.end += overlap;
    }
  }

  // Pull back (recenter the whole group on the mean target).
  const meanTarget =
    slots.reduce((sum, s) => sum + getTarget(s.item.targetPoint), 0) /
    slots.length;
  const meanCurrent =
    slots.reduce((sum, s) => sum + (s.start + s.size / 2), 0) / slots.length;
  let shift = meanTarget - meanCurrent;

  // Clamp the group inside [rangeStart, rangeEnd].
  const first = slots[0];
  const last = slots[slots.length - 1];
  const groupSize = last.end + shift - (first.start + shift);
  const range = rangeEnd - rangeStart;

  if (groupSize > range || range <= 0) {
    // Overflow: pack cumulatively in target order with a reduced gap —
    // negative when the chips alone exceed the band, giving small uniform
    // overlaps instead of random ones.
    if (slots.length === 1) {
      return [toPoint(slots[0].item, rangeStart + range / 2)];
    }
    const sumSizes = slots.reduce((sum, s) => sum + s.size, 0);
    const packedGap = (range - sumSizes) / (slots.length - 1);
    let cursor = rangeStart;
    return slots.map((slot) => {
      const center = cursor + slot.size / 2;
      cursor += slot.size + packedGap;
      return toPoint(slot.item, center);
    });
  }
  if (first.start + shift < rangeStart) shift = rangeStart - first.start;
  else if (last.end + shift > rangeEnd) shift = rangeEnd - last.end;

  return slots.map((slot) =>
    toPoint(slot.item, slot.start + slot.size / 2 + shift)
  );
}

// --- helpers ---------------------------------------------------------------

function clamp(v, min, max) {
  if (min > max) return (min + max) / 2;
  return Math.min(Math.max(v, min), max);
}
