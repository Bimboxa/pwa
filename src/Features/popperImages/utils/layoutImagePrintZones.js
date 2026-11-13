// ---------------------------------------------------------------------------
// layoutImagePrintZones — "PRINT_ZONES" display mode of the photos: dispatch
// the tiles in 4 FIXED zones (bands) along the edges of a rect (the editor
// viewport or the capture frame).
//
// Pure, px relative to the rect's top-left corner.
//
// 1. Zones: TOP / BOTTOM run along the full width (they own the corners),
//    LEFT / RIGHT between them. A zone is `tileSize` thick by default.
//    `reserved` rects (legend, cartouche, floating panels…) cut the zones:
//    each keeps its longest free segment. `zones[side]` overrides the
//    thickness and / or the two ends ({ thickness, startInset, endInset },
//    px, insets measured from the rect borders): the user resized the zone.
//    A zone never depends on the anchors: it does not move with the camera.
// 2. Assignment: a photo of `pinnedSideById` goes to its zone, full stop.
//    The others, by decreasing "regret" (photos with an obvious nearest edge
//    first), take the cheapest zone: cost = distance anchor → edge + a load
//    penalty (a crowded edge hands its farthest photos to the neighbours,
//    overflowing costs more) − a bonus for the zone the photo was in
//    (`previousSideById`), so a photo only changes zone on a clear win.
// 3. Inside a zone the tiles are sorted by anchor (leaders do not cross) and
//    packed as ONE group centred in the zone: their position does not follow
//    the anchors. A tile keeps the (clamped) aspect ratio of its photo. When
//    the group does not fit, the tiles of that zone shrink (`autoShrink`,
//    down to `minTileSize`); past that they overlap evenly.
// ---------------------------------------------------------------------------

export const PRINT_ZONE_SIDES = ["TOP", "RIGHT", "BOTTOM", "LEFT"];

const ASPECT_MIN = 2 / 3;
const ASPECT_MAX = 16 / 10;
// Weight of the zone load vs the anchor → edge distance (0 = nearest edge
// only, 1 = a full zone costs as much as crossing the whole rect).
const BALANCE_WEIGHT = 0.35;
// Extra cost of the part of the load that does not fit at full size.
const OVERFLOW_WEIGHT = 1.5;
// Bonus of the zone a photo is already in (fraction of the rect size).
const STICKY_WEIGHT = 0.25;

function clampAspect(aspect) {
  const a = Number(aspect);
  if (!Number.isFinite(a) || a <= 0) return 4 / 3;
  return Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, a));
}

function isSide(side) {
  return PRINT_ZONE_SIDES.includes(side);
}

function isHorizontal(side) {
  return side === "TOP" || side === "BOTTOM";
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

function getOverride(zones, side, key) {
  const n = Number(zones?.[side]?.[key]);
  return zones?.[side]?.[key] != null && Number.isFinite(n) ? n : null;
}

function getBands(
  { width, height },
  { tileSize, minTileSize, padding, gap, reserved, zones }
) {
  const bands = {};
  PRINT_ZONE_SIDES.forEach((side) => {
    const horizontal = isHorizontal(side);
    const crossSize = horizontal ? height : width;
    const override = getOverride(zones, side, "thickness");
    const thickness = Math.max(
      1,
      Math.min(
        Math.round(
          override != null ? Math.max(minTileSize, override) : tileSize
        ),
        Math.max(1, crossSize - 2 * padding)
      )
    );
    bands[side] = { side, horizontal, thickness };
  });
  PRINT_ZONE_SIDES.forEach((side) => {
    const band = bands[side];
    const alongSize = band.horizontal ? width : height;
    const near = side === "TOP" || side === "LEFT";
    band.cross = near
      ? padding
      : (band.horizontal ? height : width) - padding - band.thickness;
    // Default ends: the full edge, minus the corners for LEFT / RIGHT.
    let start = band.horizontal ? padding : padding + bands.TOP.thickness + gap;
    let end = band.horizontal
      ? alongSize - padding
      : alongSize - padding - bands.BOTTOM.thickness - gap;
    end = Math.max(start, end);
    const blocked = [];
    (reserved ?? []).forEach((r) => {
      if (!r || !(r.width > 0) || !(r.height > 0)) return;
      const crossStart = band.horizontal ? r.y : r.x;
      const crossSize = band.horizontal ? r.height : r.width;
      const hitsBand =
        crossStart < band.cross + band.thickness + gap &&
        crossStart + crossSize > band.cross - gap;
      if (!hitsBand) return;
      const alongStart = band.horizontal ? r.x : r.y;
      const alongLength = band.horizontal ? r.width : r.height;
      blocked.push([alongStart - gap, alongStart + alongLength + gap]);
    });
    [start, end] = getLongestFreeSegment(start, end, blocked);
    // The ends the user dragged win over the automatic ones.
    const startInset = getOverride(zones, side, "startInset");
    const endInset = getOverride(zones, side, "endInset");
    if (startInset != null) start = Math.max(0, startInset);
    if (endInset != null) end = Math.min(alongSize, alongSize - endInset);
    if (end < start + minTileSize) {
      if (endInset != null && startInset == null) {
        start = Math.max(0, end - minTileSize);
      } else {
        end = Math.min(alongSize, start + minTileSize);
      }
    }
    band.start = start;
    band.end = Math.max(start, end);
    band.range = band.end - band.start;
  });
  return bands;
}

function getEdgeDistance(anchor, side, { width, height }) {
  if (!anchor) return 0;
  if (side === "TOP") return Math.max(0, anchor.y);
  if (side === "BOTTOM") return Math.max(0, height - anchor.y);
  if (side === "LEFT") return Math.max(0, anchor.x);
  return Math.max(0, width - anchor.x);
}

function getNominalLength(entry, band) {
  return band.horizontal
    ? band.thickness * entry.aspect
    : band.thickness / entry.aspect;
}

// → { TOP: [entries], … }
function assignToBands(entries, bands, rect, gap, pinnedSideById, previous) {
  const scale = Math.min(rect.width, rect.height);
  const load = { TOP: 0, RIGHT: 0, BOTTOM: 0, LEFT: 0 };
  const bySide = { TOP: [], RIGHT: [], BOTTOM: [], LEFT: [] };
  const add = (entry, side) => {
    const length = getNominalLength(entry, bands[side]);
    load[side] += (load[side] > 0 ? gap : 0) + length;
    bySide[side].push(entry);
  };

  const free = [];
  entries.forEach((entry) => {
    const pinned = pinnedSideById?.[entry.id];
    if (isSide(pinned)) add({ ...entry, pinned: true }, pinned);
    else free.push(entry);
  });

  free
    .map((entry) => {
      const distances = PRINT_ZONE_SIDES.map((side) =>
        getEdgeDistance(entry.anchor, side, rect)
      ).sort((a, b) => a - b);
      return { entry, regret: distances[1] - distances[0] };
    })
    .sort((a, b) => b.regret - a.regret || a.entry.order - b.entry.order)
    .forEach(({ entry }) => {
      let best = null;
      PRINT_ZONE_SIDES.forEach((side) => {
        const band = bands[side];
        const used =
          load[side] +
          (load[side] > 0 ? gap : 0) +
          getNominalLength(entry, band);
        const ratio = band.range > 0 ? used / band.range : 1e6;
        const cost =
          getEdgeDistance(entry.anchor, side, rect) +
          scale *
            (BALANCE_WEIGHT * ratio +
              OVERFLOW_WEIGHT * Math.max(0, ratio - 1) -
              (previous?.[entry.id] === side ? STICKY_WEIGHT : 0));
        if (!best || cost < best.cost) best = { side, cost };
      });
      add({ ...entry, pinned: false }, best.side);
    });
  return bySide;
}

/**
 * @param {Object} params
 * @param {Array} params.items - [{ id, anchor: {x, y} | null, aspect }] in
 *   display order (no anchor: the photo cannot be projected right now)
 * @param {{width:number, height:number}} params.rect
 * @param {number} params.tileSize - default zone thickness
 * @param {number} [params.minTileSize]
 * @param {boolean} [params.autoShrink] - shrink the tiles of a crowded zone
 * @param {number} [params.gap] - spacing between tiles
 * @param {number} [params.padding] - zone inset from the rect border
 * @param {Array} [params.reserved] - [{x, y, width, height}] kept free of tiles
 * @param {Object} [params.zones] - { [side]: { thickness, startInset, endInset } }
 * @param {Object} [params.pinnedSideById] - { [id]: side } forced zones
 * @param {Object} [params.previousSideById] - { [id]: side } current zones
 * @returns {{ tiles: Array, zones: Object, tileSize: number, insets: Object }}
 *   tiles: [{ id, side, pinned, x, y, width, height }] in input order;
 *   zones: { [side]: { x, y, width, height, count } };
 *   tileSize: smallest tile thickness in use;
 *   insets: thickness taken by the occupied zones on each side.
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
  zones = null,
  pinnedSideById = null,
  previousSideById = null,
}) {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const width = Number(rect?.width) || 0;
  const height = Number(rect?.height) || 0;
  const nominal = Math.max(1, Math.round(tileSize));
  const floor = Math.min(nominal, Math.max(1, Math.round(minTileSize)));
  if (!(width > 0) || !(height > 0)) {
    return { tiles: [], zones: {}, tileSize: nominal, insets };
  }
  const size = { width, height };
  const bands = getBands(size, {
    tileSize: nominal,
    minTileSize: floor,
    padding,
    gap,
    reserved,
    zones,
  });
  const entries = (items ?? [])
    .filter((it) => it && it.id != null)
    .map((it, order) => ({
      id: it.id,
      anchor:
        Number.isFinite(it.anchor?.x) && Number.isFinite(it.anchor?.y)
          ? it.anchor
          : null,
      aspect: clampAspect(it.aspect),
      order,
    }));
  const bySide = assignToBands(
    entries,
    bands,
    size,
    gap,
    pinnedSideById,
    previousSideById
  );

  const tilesById = {};
  const zoneRects = {};
  let smallest = nominal;
  PRINT_ZONE_SIDES.forEach((side) => {
    const band = bands[side];
    const sideEntries = bySide[side];
    zoneRects[side] = band.horizontal
      ? {
          x: Math.round(band.start),
          y: Math.round(band.cross),
          width: Math.round(band.range),
          height: band.thickness,
          count: sideEntries.length,
        }
      : {
          x: Math.round(band.cross),
          y: Math.round(band.start),
          width: band.thickness,
          height: Math.round(band.range),
          count: sideEntries.length,
        };
    if (!sideEntries.length) return;
    insets[side.toLowerCase()] = padding + band.thickness + gap;

    // Along the zone: by anchor (no crossing), photos without anchor last.
    const axis = band.horizontal ? "x" : "y";
    sideEntries.sort((a, b) => {
      const ta = a.anchor ? a.anchor[axis] : Infinity;
      const tb = b.anchor ? b.anchor[axis] : Infinity;
      return ta === tb ? a.order - b.order : ta - tb;
    });

    // Tile thickness: the zone's, shrunk until the group fits.
    const n = sideEntries.length;
    const aspectSum = sideEntries.reduce(
      (sum, e) => sum + (band.horizontal ? e.aspect : 1 / e.aspect),
      0
    );
    const zoneFloor = Math.min(floor, band.thickness);
    let thickness = band.thickness;
    if (autoShrink && thickness * aspectSum + gap * (n - 1) > band.range) {
      thickness = Math.max(
        zoneFloor,
        Math.min(
          thickness,
          Math.floor((band.range - gap * (n - 1)) / aspectSum)
        )
      );
    }
    smallest = Math.min(smallest, thickness);
    const lengths = sideEntries.map((e) =>
      Math.round(band.horizontal ? thickness * e.aspect : thickness / e.aspect)
    );
    const lengthSum = lengths.reduce((sum, l) => sum + l, 0);
    // Does not fit: even overlap over the whole zone.
    const fits = lengthSum + gap * (n - 1) <= band.range;
    const step = fits || n === 1 ? gap : (band.range - lengthSum) / (n - 1);
    const groupLength = lengthSum + step * (n - 1);
    let cursor = band.start + (band.range - groupLength) / 2;
    const cross = Math.round(band.cross + (band.thickness - thickness) / 2);
    sideEntries.forEach((entry, i) => {
      const along = Math.round(cursor);
      cursor += lengths[i] + step;
      tilesById[entry.id] = band.horizontal
        ? {
            side,
            pinned: entry.pinned,
            x: along,
            y: cross,
            width: lengths[i],
            height: thickness,
          }
        : {
            side,
            pinned: entry.pinned,
            x: cross,
            y: along,
            width: thickness,
            height: lengths[i],
          };
    });
  });

  const tiles = entries.map((entry) => ({
    id: entry.id,
    ...tilesById[entry.id],
  }));
  return { tiles, zones: zoneRects, tileSize: smallest, insets };
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
