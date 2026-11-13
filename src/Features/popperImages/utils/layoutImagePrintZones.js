import { solveBand1D } from "../../annotations/utils/getImageModeLabelsLayout.js";

// ---------------------------------------------------------------------------
// layoutImagePrintZones — "PRINT_ZONES" display mode of the photos: dispatch
// the tiles in 4 bands along the edges of a rect (the editor viewport or the
// capture frame), each photo close to its anchor and the bands evenly loaded.
//
// Pure, px relative to the rect's top-left corner.
//
// 1. Bands: TOP / BOTTOM run along the full width (they own the corners),
//    LEFT / RIGHT between them. A band is `tileSize` thick; a tile keeps the
//    (clamped) aspect ratio of its photo along the band. `reserved` rects
//    (legend, cartouche, floating panels…) cut the bands: each band keeps its
//    longest free segment.
// 2. Assignment, by decreasing "regret" (photos with an obvious nearest edge
//    first): the cheapest band that still has room, cost = distance anchor →
//    edge + a load penalty (so a crowded edge hands its farthest photos to
//    the neighbours). When the photos do not all fit, the tile size shrinks
//    (`autoShrink`) down to `minTileSize`; past that, the least loaded band
//    takes the overflow and its tiles overlap evenly.
// 3. Along a band the tiles are sorted by anchor (leaders never cross) and
//    centred on their anchors (solveBand1D: push, recentre, clamp).
// ---------------------------------------------------------------------------

export const PRINT_ZONE_SIDES = ["TOP", "RIGHT", "BOTTOM", "LEFT"];

const ASPECT_MIN = 2 / 3;
const ASPECT_MAX = 16 / 10;
const SHRINK_STEP = 0.9;
// Weight of the band load vs the anchor → edge distance (0 = nearest edge
// only, 1 = a full band costs as much as crossing the whole rect).
const BALANCE_WEIGHT = 0.35;

function clampAspect(aspect) {
  const a = Number(aspect);
  if (!Number.isFinite(a) || a <= 0) return 4 / 3;
  return Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, a));
}

// Longest free segment of [start, end] once the blocked intervals are cut.
function getLongestFreeSegment(start, end, blocked) {
  const sorted = blocked
    .map(([a, b]) => [Math.max(start, a), Math.min(end, b)])
    .filter(([a, b]) => b > a)
    .sort((i, j) => i[0] - j[0]);
  let best = null;
  let cursor = start;
  const consider = (a, b) => {
    if (b - a > 0 && (!best || b - a > best[1] - best[0])) best = [a, b];
  };
  sorted.forEach(([a, b]) => {
    consider(cursor, a);
    cursor = Math.max(cursor, b);
  });
  consider(cursor, end);
  return best ?? [start, start];
}

function getBands({ width, height }, tileSize, padding, gap, reserved) {
  const corner = padding + tileSize + gap;
  const bands = {
    TOP: {
      horizontal: true,
      cross: padding,
      start: padding,
      end: width - padding,
    },
    BOTTOM: {
      horizontal: true,
      cross: height - padding - tileSize,
      start: padding,
      end: width - padding,
    },
    LEFT: {
      horizontal: false,
      cross: padding,
      start: corner,
      end: height - corner,
    },
    RIGHT: {
      horizontal: false,
      cross: width - padding - tileSize,
      start: corner,
      end: height - corner,
    },
  };
  PRINT_ZONE_SIDES.forEach((side) => {
    const band = bands[side];
    const blocked = [];
    (reserved ?? []).forEach((r) => {
      if (!r || !(r.width > 0) || !(r.height > 0)) return;
      const crossStart = band.horizontal ? r.y : r.x;
      const crossSize = band.horizontal ? r.height : r.width;
      const hitsBand =
        crossStart < band.cross + tileSize + gap &&
        crossStart + crossSize > band.cross - gap;
      if (!hitsBand) return;
      const alongStart = band.horizontal ? r.x : r.y;
      const alongSize = band.horizontal ? r.width : r.height;
      blocked.push([alongStart - gap, alongStart + alongSize + gap]);
    });
    const [start, end] = getLongestFreeSegment(
      band.start,
      Math.max(band.start, band.end),
      blocked
    );
    band.start = start;
    band.end = end;
    band.range = Math.max(0, end - start);
  });
  return bands;
}

function getEdgeDistance(anchor, side, { width, height }) {
  if (side === "TOP") return Math.max(0, anchor.y);
  if (side === "BOTTOM") return Math.max(0, height - anchor.y);
  if (side === "LEFT") return Math.max(0, anchor.x);
  return Math.max(0, width - anchor.x);
}

// → { TOP: [entries], … } or null when a photo fits nowhere (and !force).
function assignToBands(entries, bands, rect, tileSize, gap, force) {
  const scale = Math.min(rect.width, rect.height);
  const load = { TOP: 0, RIGHT: 0, BOTTOM: 0, LEFT: 0 };
  const bySide = { TOP: [], RIGHT: [], BOTTOM: [], LEFT: [] };
  const getLength = (entry, side) =>
    bands[side].horizontal ? tileSize * entry.aspect : tileSize / entry.aspect;

  const ordered = entries
    .map((entry) => {
      const distances = PRINT_ZONE_SIDES.map((side) =>
        getEdgeDistance(entry.anchor, side, rect)
      ).sort((a, b) => a - b);
      return { entry, regret: distances[1] - distances[0] };
    })
    .sort((a, b) => b.regret - a.regret || a.entry.order - b.entry.order);

  for (const { entry } of ordered) {
    let best = null;
    let fallback = null;
    PRINT_ZONE_SIDES.forEach((side) => {
      const band = bands[side];
      const length = getLength(entry, side);
      const used = load[side] + (load[side] > 0 ? gap : 0) + length;
      const ratio = band.range > 0 ? used / band.range : Infinity;
      if (!fallback || ratio < fallback.ratio) {
        fallback = { side, length, used, ratio };
      }
      if (used > band.range) return;
      const cost =
        getEdgeDistance(entry.anchor, side, rect) +
        BALANCE_WEIGHT * scale * (load[side] / band.range);
      if (!best || cost < best.cost) best = { side, length, used, cost };
    });
    const choice = best ?? (force ? fallback : null);
    if (!choice) return null;
    load[choice.side] = choice.used;
    bySide[choice.side].push({ ...entry, length: choice.length });
  }
  return bySide;
}

/**
 * @param {Object} params
 * @param {Array} params.items - [{ id, anchor: {x, y}, aspect }] in display order
 * @param {{width:number, height:number}} params.rect
 * @param {number} params.tileSize - band thickness (target when autoShrink)
 * @param {number} [params.minTileSize]
 * @param {boolean} [params.autoShrink]
 * @param {number} [params.gap] - spacing between tiles
 * @param {number} [params.padding] - band inset from the rect border
 * @param {Array} [params.reserved] - [{x, y, width, height}] kept free of tiles
 * @returns {{ tiles: Array, tileSize: number, insets: Object }}
 *   tiles: [{ id, side, x, y, width, height }] in input order;
 *   insets: thickness taken by the occupied bands on each side.
 */
export default function layoutImagePrintZones({
  items,
  rect,
  tileSize = 160,
  minTileSize = 64,
  autoShrink = true,
  gap = 8,
  padding = 12,
  reserved = [],
}) {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const width = Number(rect?.width) || 0;
  const height = Number(rect?.height) || 0;
  const entries = (items ?? [])
    .filter(
      (it) =>
        it && Number.isFinite(it.anchor?.x) && Number.isFinite(it.anchor?.y)
    )
    .map((it, order) => ({
      id: it.id,
      anchor: it.anchor,
      aspect: clampAspect(it.aspect),
      order,
    }));
  if (!entries.length || !(width > 0) || !(height > 0)) {
    return { tiles: [], tileSize, insets };
  }
  const size = { width, height };

  let current = Math.max(1, Math.round(tileSize));
  const floor = Math.min(current, Math.max(1, Math.round(minTileSize)));
  let bands;
  let bySide;
  for (;;) {
    bands = getBands(size, current, padding, gap, reserved);
    const canShrink = autoShrink && current > floor;
    bySide = assignToBands(entries, bands, size, current, gap, !canShrink);
    if (bySide) break;
    current = Math.max(floor, Math.floor(current * SHRINK_STEP));
  }

  const tilesById = {};
  PRINT_ZONE_SIDES.forEach((side) => {
    const band = bands[side];
    const sideEntries = bySide[side];
    if (!sideEntries.length) return;
    insets[side.toLowerCase()] = padding + current + gap;
    const axis = band.horizontal ? "x" : "y";
    solveBand1D(
      sideEntries
        .sort((a, b) => a.order - b.order)
        .map((entry) => ({ entry, targetPoint: entry.anchor })),
      {
        getTarget: (p) => p[axis],
        getSize: (slot) => slot.entry.length,
        rangeStart: band.start,
        rangeEnd: band.end,
        gap,
        toPoint: (slot, center) => ({ entry: slot.entry, center }),
      }
    ).forEach(({ entry, center }) => {
      const along = Math.round(center - entry.length / 2);
      const length = Math.round(entry.length);
      tilesById[entry.id] = band.horizontal
        ? {
            side,
            x: along,
            y: Math.round(band.cross),
            width: length,
            height: current,
          }
        : {
            side,
            x: Math.round(band.cross),
            y: along,
            width: current,
            height: length,
          };
    });
  });

  const tiles = entries.map((entry) => ({
    id: entry.id,
    ...tilesById[entry.id],
  }));
  return { tiles, tileSize: current, insets };
}

// Point of a tile's inner edge (the one facing the rect centre) where its
// leader starts, as close as possible to the anchor.
export function getPrintZoneTileLinkPoint(tile, anchor) {
  const clampTo = (v, min, max) => Math.min(max, Math.max(min, v));
  const inset = Math.min(12, tile.width / 2, tile.height / 2);
  if (tile.side === "TOP" || tile.side === "BOTTOM") {
    return {
      x: clampTo(anchor.x, tile.x + inset, tile.x + tile.width - inset),
      y: tile.side === "TOP" ? tile.y + tile.height : tile.y,
    };
  }
  return {
    x: tile.side === "LEFT" ? tile.x + tile.width : tile.x,
    y: clampTo(anchor.y, tile.y + inset, tile.y + tile.height - inset),
  };
}
