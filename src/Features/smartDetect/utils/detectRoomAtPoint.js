/**
 * Detect the room around a click on a raster floor plan — « Pièce » tool.
 *
 * Deterministic, works on the wall-line masks of buildWallLineMasks.js (long
 * solid ortho strokes only, in the ortho frame). Every tolerance is in METRES.
 *
 *   1. RECTANGLE GLUED TO THE WALLS. Four rays from the seed give a first
 *      rectangle. A side is "on a wall" when the line under it
 *        - is covered by wall cells over at least `coverageRatio` of the
 *          side's span (a door leaves the coverage above the ratio, a stray
 *          stroke does not), or
 *        - carries a wall stub of at least `minAttachedM` starting at one end
 *          of the span (wall next to a corner door, notch of an L room).
 *      Each side is pulled to the valid line nearest to the seed, the spans
 *      of the perpendicular sides changing as the rectangle settles (fixed
 *      point). Shrinks are applied before expansions: an oversized span (ray
 *      through a door) hides the true walls, an undersized one does not.
 *      The leaf of an open door lying next to a wall is skipped (see
 *      isDoorLeaf): the side goes to the wall behind it.
 *
 *   2. EXTENSIONS, according to `shape`:
 *        - "RECTANGLE": none.
 *        - "AUTO": every stretch of a side that is NOT covered and is wider
 *          than a door (`maxDoorM`) opens a child rectangle, grown outwards
 *          with the same rule (its near side pinned on the parent side),
 *          recursively.
 *        - "L": exactly one child, the largest one, through an opening that
 *          is either wider than a door or flush with a corner of the
 *          rectangle (corridor mouth: no wider than a door, but no jamb).
 *
 *   3. The union of the rectangles (minus the corner notches of a drawn
 *      rectangle, see carveNotches) is traced as one rectilinear polygon.
 *
 * Sides sit on the INNER face of the walls (first wall cell).
 *
 * @param {Object} params
 * @param {Object} params.masks Result of buildWallLineMasks.
 * @param {{x:number,y:number}} params.seed Click, source-image px.
 * @param {"AUTO"|"RECTANGLE"|"L"} [params.shape="AUTO"]
 * @param {number} [params.coverageRatio=0.4]
 * @param {number} [params.maxDoorM=1.6] Widest opening still read as a door.
 * @param {number} [params.minAttachedM=0.3] Shortest corner stub read as a wall.
 * @param {number} [params.minLegM=0.5] Narrowest leg of an L room.
 * @param {number} [params.cornerToleranceM=0.05] "Flush" / "touching" distance.
 * @param {number} [params.minRoomM=0.3] Smallest room side.
 * @param {number} [params.doorLeafMaxLengthM=1.3] Longest door leaf.
 * @param {number} [params.doorLeafClearanceM=0.25] Largest leaf-to-wall distance.
 * @param {number} [params.maxDepth=2] Levels of child rectangles ("AUTO").
 * @param {number} [params.maxRects=12]
 * @param {{p1:{x,y},p2:{x,y}}} [params.baseRectangle] Rectangle drawn by the
 *   user (p1 = clicked corner, p2 = cursor, source-image px), used INSTEAD
 *   of the seed. The room goes through the clicked corner; the two other
 *   sides are snapped to the wall within `rectangleSnapM` (a side with no
 *   wall around stays where it was drawn). Then, unless `shape` is
 *   "RECTANGLE", a corner closed by walls is carved out (L room) and the
 *   extensions of step 2 apply.
 * @param {number} [params.rectangleSnapM=0.5]
 * @returns {{points:Array<{x,y}>, rects:Array}|{points:null, reason:string}}
 *   `points` in source-image px.
 */

const MAX_ITERATIONS = 32;

const SIDES = [
  { key: "right", axis: "v", dir: 1, opposite: "left" },
  { key: "left", axis: "v", dir: -1, opposite: "right" },
  { key: "bottom", axis: "h", dir: 1, opposite: "top" },
  { key: "top", axis: "h", dir: -1, opposite: "bottom" },
];

export default function detectRoomAtPoint({
  masks,
  seed,
  shape = "AUTO",
  coverageRatio = 0.4,
  maxDoorM = 1.6,
  minAttachedM = 0.3,
  minLegM = 0.5,
  cornerToleranceM = 0.05,
  minRoomM = 0.3,
  doorLeafMaxLengthM = 1.3,
  doorLeafClearanceM = 0.25,
  maxDepth = 2,
  maxRects = 12,
  baseRectangle = null,
  rectangleSnapM = 0.5,
}) {
  if (!masks || (!seed && !baseRectangle)) {
    return { points: null, reason: "NO_INPUT" };
  }

  const ctx = createContext(masks, {
    coverageRatio,
    maxDoorM,
    minAttachedM,
    minLegM,
    cornerToleranceM,
    minRoomM,
    doorLeafMaxLengthM,
    doorLeafClearanceM,
  });
  let root;
  if (baseRectangle) {
    root = snapRectangle(ctx, masks, baseRectangle, rectangleSnapM);
    if (!root) return { points: null, reason: "TOO_SMALL" };
    refineEdges(ctx, masks, root, null);
  } else {
    const g = masks.fromImagePx(seed);
    const rootSeed = { x: Math.floor(g.x), y: Math.floor(g.y) };

    if (!ctx.isInside(rootSeed)) {
      return { points: null, reason: "OUT_OF_IMAGE" };
    }
    if (masks.isExcludedAt?.(seed)) {
      return { points: null, reason: "SEED_ON_ANNOTATION" };
    }
    if (ctx.isWall(rootSeed)) return { points: null, reason: "SEED_ON_WALL" };

    root = solveRectangle(ctx, rootSeed, null);
    if (!root) return { points: null, reason: "OPEN" };
    refineEdges(ctx, masks, root, null);
  }

  const rects = [root];

  // child of `rect` through one of its openings, or null
  const solveChild = (rect, side, childSeed) => {
    if (!ctx.isInside(childSeed) || ctx.isWall(childSeed)) return null;
    if (rects.some((r) => containsCell(r, childSeed))) return null;
    const child = solveRectangle(ctx, childSeed, {
      key: side.opposite,
      value: rect[side.key],
    });
    if (child) refineEdges(ctx, masks, child, side.opposite);
    return child;
  };

  // a drawn rectangle may hold another room in a corner: carve it (L shape)
  const notches =
    baseRectangle && shape !== "RECTANGLE"
      ? carveNotches(ctx, root, shape)
      : [];

  if (shape === "L" && notches.length) {
    // the L is the rectangle minus its corner notch: no leg on top of it
  } else if (shape === "L") {
    // the largest leg through a wide or corner-flush opening
    let best = null;
    for (const side of SIDES) {
      for (const opening of getOpenings(ctx, root, side)) {
        if (!opening.isWide && !opening.isFlush) continue;
        const child = solveChild(root, side, opening.seed);
        if (child && (!best || getRectArea(child) > getRectArea(best))) {
          best = child;
        }
      }
    }
    if (best) rects.push(best);
  } else if (shape === "AUTO") {
    // children through the wide openings, recursively
    const queue = [{ rect: root, depth: 0, pinnedKey: null }];
    while (queue.length && rects.length < maxRects) {
      const { rect, depth, pinnedKey } = queue.shift();
      if (depth >= maxDepth) continue;
      for (const side of SIDES) {
        if (side.key === pinnedKey) continue;
        for (const opening of getOpenings(ctx, rect, side)) {
          if (rects.length >= maxRects) break;
          if (!opening.isWide) continue;
          const child = solveChild(rect, side, opening.seed);
          if (!child) continue;
          rects.push(child);
          queue.push({
            rect: child,
            depth: depth + 1,
            pinnedKey: side.opposite,
          });
        }
      }
    }
  }

  const loop = traceUnion(rects, notches);
  if (!loop || loop.length < 4) return { points: null, reason: "NO_OUTLINE" };

  return { points: loop.map(masks.toImagePx), rects };
}

// ---------------------------------------------------------------------------
// mask access
// ---------------------------------------------------------------------------

function createContext(masks, options) {
  const { width, height, vCount, hCount, vWide, hWide, wide, meterByCell } =
    masks;
  const toCells = (meters) => Math.max(1, Math.round(meters / meterByCell));

  // wall cells of the line `pos` (column for "v", row for "h") in [a, b)
  const lookup = (vArray, hArray) => (axis, pos, a, b) =>
    axis === "v"
      ? vArray[pos * (height + 1) + b] - vArray[pos * (height + 1) + a]
      : hArray[pos * (width + 1) + b] - hArray[pos * (width + 1) + a];
  const count = lookup(vCount, hCount); // the line itself
  const countWide = lookup(vWide, hWide); // the line +/- the line tolerance

  const limit = (axis) => (axis === "v" ? width : height);
  const spanLimit = (axis) => (axis === "v" ? height : width);

  return {
    width,
    height,
    wide,
    coverageRatio: options.coverageRatio,
    maxDoor: toCells(options.maxDoorM),
    minAttached: toCells(options.minAttachedM),
    minLeg: toCells(options.minLegM),
    cornerTolerance: toCells(options.cornerToleranceM),
    minRoom: toCells(options.minRoomM),
    doorLeafMaxLength: toCells(options.doorLeafMaxLengthM),
    doorLeafClearance: toCells(options.doorLeafClearanceM),
    count,
    countWide,
    limit,
    spanLimit,
    isWallAt: (axis, pos, t) => countWide(axis, pos, t, t + 1) > 0,
    isInside: (p) => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height,
    isWall: (p) =>
      count("v", p.x, p.y, p.y + 1) > 0 || count("h", p.y, p.x, p.x + 1) > 0,
  };
}

// Length of the wall run starting at one end of [a, b) on the line `pos`
// (the longest of the two ends), holes of 2 cells tolerated.
function getAttachedRun(ctx, axis, pos, a, b) {
  return Math.max(
    getRunFromEnd(ctx, axis, pos, a, b, true),
    getRunFromEnd(ctx, axis, pos, a, b, false)
  );
}

// Length of the wall run of the line `pos` starting at the start (or the
// end) of [a, b), holes of 2 cells tolerated.
function getRunFromEnd(ctx, axis, pos, a, b, fromStart) {
  const step = fromStart ? 1 : -1;
  let run = 0;
  let gap = 0;
  for (let t = fromStart ? a : b - 1; t >= a && t < b; t += step) {
    if (ctx.isWallAt(axis, pos, t)) {
      run += gap + 1;
      gap = 0;
    } else if (++gap > 2) break;
  }
  return run;
}

// Is the line `pos` a wall for a side spanning [a, b)?
function isWallLine(ctx, axis, pos, a, b) {
  const length = b - a;
  if (length <= 0) return false;
  const covered = ctx.countWide(axis, pos, a, b);
  if (covered >= ctx.coverageRatio * length) return true;
  if (covered < ctx.minAttached) return false;
  return getAttachedRun(ctx, axis, pos, a, b) >= ctx.minAttached;
}

/**
 * Is the wall line `face` the leaf of an open door lying next to a wall?
 *   - a single short run (<= doorLeafMaxLength),
 *   - doubled, within doorLeafClearance behind it, by a wall line covering
 *     its whole length and running past one of its free ends (an end no
 *     perpendicular wall line touches).
 */
function isDoorLeaf(ctx, side, face, a, b) {
  const { axis, dir } = side;
  const perp = axis === "v" ? "h" : "v";
  const max = ctx.spanLimit(axis);
  const has = (t) => t >= 0 && t < max && ctx.count(axis, face, t, t + 1) > 0;

  // the run of the line crossing the span
  let t0 = -1;
  for (let t = Math.max(0, a); t < Math.min(max, b) && t0 < 0; t++) {
    if (has(t)) t0 = t;
  }
  if (t0 < 0) return false;
  const walk = (step) => {
    let end = t0;
    for (let t = t0 + step, gap = 0; t >= 0 && t < max; t += step) {
      if (has(t)) {
        end = t;
        gap = 0;
      } else if (++gap > 2) break;
      if (Math.abs(end - t0) > ctx.doorLeafMaxLength) break;
    }
    return end;
  };
  const start = walk(-1);
  const end = walk(1);
  if (end - start + 1 > ctx.doorLeafMaxLength) return false;

  // dangling end
  const k = ctx.cornerTolerance;
  const perpLimit = ctx.spanLimit(perp);
  const isAttached = (t) => {
    const from = Math.max(0, face - k);
    const to = Math.min(perpLimit, face + k + 1);
    for (let line = t - k; line <= t + k; line++) {
      if (line < 0 || line >= ctx.limit(perp)) continue;
      if (ctx.count(perp, line, from, to) > 0) return true;
    }
    return false;
  };
  // wall right behind, covering the leaf and running past one of its free
  // ends. The two faces of a wall never do that: they stop together at a
  // door jamb, and at a corner the inner face is attached.
  const length = end - start + 1;
  const beyond = 2 * k;
  const freeEnds = [];
  if (start - beyond >= 0 && !isAttached(start)) {
    freeEnds.push([start - beyond, start]);
  }
  if (end + 1 + beyond <= max && !isAttached(end)) {
    freeEnds.push([end + 1, end + 1 + beyond]);
  }
  if (!freeEnds.length) return false;
  // (lines are read widened: stay within the clearance)
  const maxDistance = ctx.doorLeafClearance - ctx.wide;
  for (let d = 2 * ctx.wide + 1; d <= maxDistance; d++) {
    const line = face + dir * d;
    if (line < 0 || line >= ctx.limit(axis)) break;
    if (ctx.countWide(axis, line, start, end + 1) < 0.9 * length) continue;
    if (freeEnds.some(([p, q]) => ctx.countWide(axis, line, p, q) === beyond)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// rectangle
// ---------------------------------------------------------------------------

// Rect edges are continuous cell coordinates: interior cells are
// [left, right) x [top, bottom). `lines[key]` is the index of the wall line
// that validated the side.

function containsCell(rect, p) {
  return (
    p.x >= rect.left && p.x < rect.right && p.y >= rect.top && p.y < rect.bottom
  );
}

function getRectArea(rect) {
  return (rect.right - rect.left) * (rect.bottom - rect.top);
}

function getSpan(rect, side) {
  return side.axis === "v" ? [rect.top, rect.bottom] : [rect.left, rect.right];
}

/**
 * Nearest wall from the seed outwards, for a side spanning [a, b):
 * { edge, line } or null. `line` is the first line whose widened coverage
 * validates the side, `edge` the inner face (first line really carrying wall
 * cells) around it.
 */
function findEdge(ctx, side, seed, a, b) {
  const { axis, dir } = side;
  const from = axis === "v" ? seed.x : seed.y;
  const limit = ctx.limit(axis);
  let skipped = from; // faces up to here are not walls (seed, door leaves)

  for (let pos = from + dir; pos >= 0 && pos < limit; pos += dir) {
    if (!isWallLine(ctx, axis, pos, a, b)) continue;
    const face = getFace(ctx, side, pos, a, b, skipped);
    if (face === null) continue;
    if (isDoorLeaf(ctx, side, face, a, b)) {
      skipped = face;
      continue;
    }
    return { edge: dir > 0 ? face : face + 1, line: pos };
  }
  return null;
}

/**
 * Move the sides of `rect` off the anti-aliased fringe of their wall: a
 * raster line is edged by grey pixels, dark enough to be read as ink, which
 * would leave a white sliver between the room and the wall. While the line
 * under a side is less than half as dark as one of the next two, the side
 * steps forward (3 steps at most). A thin grey line followed by blank is a
 * wall face of its own and is kept. `skipKey`: side left untouched (the
 * pinned side of a child).
 */
function refineEdges(ctx, masks, rect, skipKey) {
  if (!masks.getDarknessAt) return;
  for (const side of SIDES) {
    if (side.key === skipKey || rect.lines[side.key] === undefined) continue;
    const { axis, dir } = side;
    const [a, b] = getSpan(rect, side);
    const getLineDarkness = (line) => {
      if (line < 0 || line >= ctx.limit(axis)) return 0;
      let sum = 0;
      for (let t = a; t < b; t++) {
        sum +=
          axis === "v"
            ? masks.getDarknessAt(line, t)
            : masks.getDarknessAt(t, line);
      }
      return sum;
    };
    for (let step = 0; step < 3; step++) {
      const face = dir > 0 ? rect[side.key] : rect[side.key] - 1;
      const next = Math.max(
        getLineDarkness(face + dir),
        getLineDarkness(face + 2 * dir)
      );
      if (getLineDarkness(face) >= 0.5 * next) break;
      rect[side.key] += dir;
    }
  }
}

// Inner face of the wall validated by the widened line `pos`: the first line
// around it really carrying wall cells, beyond `skipped` when given.
function getFace(ctx, side, pos, a, b, skipped = null) {
  const { axis, dir } = side;
  const limit = ctx.limit(axis);
  const minCount = Math.max(1, 0.2 * ctx.countWide(axis, pos, a, b));
  for (let d = -ctx.wide; d <= ctx.wide; d++) {
    const line = pos + dir * d;
    if (line < 0 || line >= limit) continue;
    if (skipped !== null && (line - skipped) * dir <= 0) continue;
    if (ctx.count(axis, line, a, b) >= minCount) return line;
  }
  return null;
}

/**
 * Rectangle drawn by the user (p1 = clicked corner, p2 = cursor). The two
 * sides meeting at the clicked corner are kept as drawn; the two others are
 * snapped to the wall found within `snapM` (the innermost one). A side without wall
 * around keeps its drawn position (and gets no `lines` entry: no extension
 * through it). Returns null when the rectangle is too small.
 */
function snapRectangle(ctx, masks, { p1, p2 }, snapM) {
  const g1 = masks.fromImagePx(p1);
  const g2 = masks.fromImagePx(p2);
  const clamp = (value, max) => Math.max(0, Math.min(max, Math.round(value)));
  const rect = {
    left: clamp(Math.min(g1.x, g2.x), ctx.width),
    right: clamp(Math.max(g1.x, g2.x), ctx.width),
    top: clamp(Math.min(g1.y, g2.y), ctx.height),
    bottom: clamp(Math.max(g1.y, g2.y), ctx.height),
    lines: {},
  };
  const isBigEnough = (r) =>
    r.right - r.left >= ctx.minRoom && r.bottom - r.top >= ctx.minRoom;
  if (!isBigEnough(rect)) return null;

  // the two sides meeting at the clicked corner (p1) stay where they were
  // drawn: the room goes through the click
  const pinned = [
    g1.x >= g2.x ? "right" : "left",
    g1.y >= g2.y ? "bottom" : "top",
  ];
  rect.pinnedCorner = pinned;

  const drawn = { ...rect };
  const snap = Math.max(1, Math.round(snapM / masks.meterByCell));
  // two passes: the spans of the second one are the snapped ones
  for (let pass = 0; pass < 2; pass++) {
    for (const side of SIDES) {
      if (pinned.includes(side.key)) continue;
      const { axis, dir } = side;
      const [a, b] = getSpan(rect, side);
      const target = dir > 0 ? drawn[side.key] : drawn[side.key] - 1;
      // from inside the rectangle outwards: the first wall met is seen from
      // the room, so the side lands on its inner face
      let found = null;
      for (let d = -snap; d <= snap && !found; d++) {
        const pos = target + dir * d;
        if (pos < 0 || pos >= ctx.limit(axis)) continue;
        if (!isWallLine(ctx, axis, pos, a, b)) continue;
        const face = getFace(ctx, side, pos, a, b);
        if (face === null || isDoorLeaf(ctx, side, face, a, b)) continue;
        found = { edge: dir > 0 ? face : face + 1, line: pos };
      }
      rect[side.key] = found ? found.edge : drawn[side.key];
      if (found) rect.lines[side.key] = found.line;
      else delete rect.lines[side.key];
    }
    if (!isBigEnough(rect))
      return { ...drawn, lines: {}, pinnedCorner: pinned };
  }
  return rect;
}

/**
 * Corner notches of a drawn rectangle: a corner of the rectangle closed by
 * two walls — a vertical one attached to its horizontal side and a
 * horizontal one attached to its vertical side — is another room (or a
 * shaft, a column…): the room is the rectangle minus that corner (L shape).
 * Both walls must cover at least `coverageRatio` of the notch side they
 * carry (a door is allowed). The largest closed notch is kept per corner;
 * the clicked corner is never carved. Returns notch rectangles
 * { left, right, top, bottom }: "L" keeps the largest one only.
 */
function carveNotches(ctx, rect, shape) {
  const notches = [];
  const [pinnedH, pinnedV] = rect.pinnedCorner ?? [];
  for (const hKey of ["left", "right"]) {
    for (const vKey of ["top", "bottom"]) {
      if (hKey === pinnedH && vKey === pinnedV) continue;
      const notch = findCornerNotch(ctx, rect, hKey, vKey);
      if (notch) notches.push(notch);
    }
  }
  notches.sort((p, q) => getRectArea(q) - getRectArea(p));
  return shape === "L" ? notches.slice(0, 1) : notches;
}

function findCornerNotch(ctx, rect, hKey, vKey) {
  const { left, right, top, bottom } = rect;
  const isRight = hKey === "right";
  const isBottom = vKey === "bottom";

  // vertical lines carrying a wall attached to the horizontal side `vKey`,
  // horizontal lines carrying a wall attached to the vertical side `hKey`
  const xs = [];
  for (let x = left + ctx.minLeg; x < right - ctx.minLeg; x++) {
    if (ctx.countWide("v", x, top, bottom) < ctx.minAttached) continue;
    if (getRunFromEnd(ctx, "v", x, top, bottom, !isBottom) >= ctx.minAttached) {
      xs.push(x);
    }
  }
  if (!xs.length) return null;
  const ys = [];
  for (let y = top + ctx.minLeg; y < bottom - ctx.minLeg; y++) {
    if (ctx.countWide("h", y, left, right) < ctx.minAttached) continue;
    if (getRunFromEnd(ctx, "h", y, left, right, !isRight) >= ctx.minAttached) {
      ys.push(y);
    }
  }

  // largest corner closed by a pair of them
  let best = null;
  for (const x of xs) {
    const [ha, hb] = isRight ? [x, right] : [left, x + 1];
    for (const y of ys) {
      const [va, vb] = isBottom ? [y, bottom] : [top, y + 1];
      const area = (hb - ha) * (vb - va);
      if (best && area <= best.area) continue;
      if (ctx.countWide("v", x, va, vb) < ctx.coverageRatio * (vb - va))
        continue;
      if (ctx.countWide("h", y, ha, hb) < ctx.coverageRatio * (hb - ha))
        continue;
      best = { x, y, ha, hb, va, vb, area };
    }
  }
  if (!best) return null;

  // faces of the two walls seen from the room
  const sideV = { axis: "v", dir: isRight ? 1 : -1 };
  const sideH = { axis: "h", dir: isBottom ? 1 : -1 };
  const faceX = getFace(ctx, sideV, best.x, best.va, best.vb) ?? best.x;
  const faceY = getFace(ctx, sideH, best.y, best.ha, best.hb) ?? best.y;
  const edgeX = isRight ? faceX : faceX + 1;
  const edgeY = isBottom ? faceY : faceY + 1;
  return {
    left: isRight ? edgeX : left,
    right: isRight ? right : edgeX,
    top: isBottom ? edgeY : top,
    bottom: isBottom ? bottom : edgeY,
  };
}

/**
 * Corners (source-image px) of the rectangle of the ortho frame whose
 * diagonal is p1-p2 — the plain, undetected rectangle.
 */
export function getFrameRectangle(masks, p1, p2) {
  const g1 = masks.fromImagePx(p1);
  const g2 = masks.fromImagePx(p2);
  return [
    { x: g1.x, y: g1.y },
    { x: g2.x, y: g1.y },
    { x: g2.x, y: g2.y },
    { x: g1.x, y: g2.y },
  ].map(masks.toImagePx);
}

function isEdgeValid(ctx, side, rect) {
  const line = rect.lines[side.key];
  if (line === undefined) return false;
  const [a, b] = getSpan(rect, side);
  return isWallLine(ctx, side.axis, line, a, b);
}

// signed gain of moving a side to `edge` (> 0: nearer to the seed)
function getShrink(side, rect, edge) {
  return side.dir > 0 ? rect[side.key] - edge : edge - rect[side.key];
}

/**
 * Rectangle glued to the walls around `seed`. `pinned` = { key, value }
 * freezes one side (the opening a child rectangle comes through).
 * Returns null when a side cannot be closed.
 */
function solveRectangle(ctx, seed, pinned) {
  const free = SIDES.filter((s) => s.key !== pinned?.key);
  const along = (side) => (side.axis === "v" ? seed.y : seed.x);

  const rect = {
    left: 0,
    right: ctx.width,
    top: 0,
    bottom: ctx.height,
    lines: {},
  };
  if (pinned) rect[pinned.key] = pinned.value;
  const apply = (side, found) => {
    rect[side.key] = found.edge;
    rect.lines[side.key] = found.line;
  };

  // 1. rays
  for (const side of free) {
    const t = along(side);
    const found = findEdge(ctx, side, seed, t, t + 1);
    if (found) apply(side, found);
  }

  // 2. fixed point
  const window = 2 * ctx.maxDoor;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 2a. largest shrink first
    let best = null;
    for (const side of free) {
      const [a, b] = getSpan(rect, side);
      const found = findEdge(ctx, side, seed, a, b);
      if (!found) continue;
      const shrink = getShrink(side, rect, found.edge);
      if (shrink > 0 && (!best || shrink > best.shrink)) {
        best = { side, found, shrink };
      }
    }
    if (best) {
      apply(best.side, best.found);
      continue;
    }

    const invalid = free.filter((side) => !isEdgeValid(ctx, side, rect));
    if (!invalid.length) {
      const isBigEnough =
        rect.right - rect.left >= ctx.minRoom &&
        rect.bottom - rect.top >= ctx.minRoom;
      return isBigEnough ? rect : null;
    }

    // 2b. several oversized sides hide each other: look at the walls in a
    // window around the seed only
    for (const side of invalid) {
      const [a, b] = getSpan(rect, side);
      const t = along(side);
      const wa = Math.max(a, t - window);
      const wb = Math.min(b, t + window + 1);
      if (wa === a && wb === b) continue;
      const found = findEdge(ctx, side, seed, wa, wb);
      if (found && getShrink(side, rect, found.edge) > 0) {
        best = { side, found };
        break;
      }
    }
    if (best) {
      apply(best.side, best.found);
      continue;
    }

    // 2c. the side is on a stray stroke: push it to the next wall
    const side = invalid[0];
    const [a, b] = getSpan(rect, side);
    const found = findEdge(ctx, side, seed, a, b);
    if (!found) return null;
    apply(side, found);
  }
  return null;
}

/**
 * Stretches of a side that are not covered by a wall, at least `minLeg` wide:
 * { seed, isWide, isFlush }.
 *   - seed: cell just behind the side, in the middle of the stretch
 *   - isWide: wider than a door
 *   - isFlush: reaches an end of the side (no jamb)
 */
function getOpenings(ctx, rect, side) {
  const line = rect.lines[side.key];
  if (line === undefined) return [];
  const across = line + side.dir * (2 * ctx.wide + 2);
  const [a, b] = getSpan(rect, side);
  const openings = [];
  let start = -1;
  for (let t = a; t <= b; t++) {
    const open = t < b && !ctx.isWallAt(side.axis, line, t);
    if (open) {
      if (start < 0) start = t;
    } else if (start >= 0) {
      const length = t - start;
      if (length >= ctx.minLeg) {
        const mid = Math.floor((start + t) / 2);
        openings.push({
          seed:
            side.axis === "v" ? { x: across, y: mid } : { x: mid, y: across },
          isWide: length > ctx.maxDoor,
          isFlush:
            start - a <= ctx.cornerTolerance || b - t <= ctx.cornerTolerance,
        });
      }
      start = -1;
    }
  }
  return openings;
}

// ---------------------------------------------------------------------------
// union of rectangles -> outer rectilinear loop
// ---------------------------------------------------------------------------

function traceUnion(rects, notches = []) {
  const uniq = (values) => [...new Set(values)].sort((p, q) => p - q);
  const all = [...rects, ...notches];
  const xs = uniq(all.flatMap((r) => [r.left, r.right]));
  const ys = uniq(all.flatMap((r) => [r.top, r.bottom]));
  const isIn = (r, cx, cy) =>
    cx > r.left && cx < r.right && cy > r.top && cy < r.bottom;
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  if (nx < 1 || ny < 1) return null;

  const filled = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      if (
        rects.some((r) => isIn(r, cx, cy)) &&
        !notches.some((r) => isIn(r, cx, cy))
      ) {
        filled[j * nx + i] = 1;
      }
    }
  }
  const isFilled = (i, j) =>
    i >= 0 && j >= 0 && i < nx && j < ny && filled[j * nx + i] === 1;

  // directed boundary edges, clockwise on screen (y down)
  const edges = new Map(); // "i,j" -> [[i2, j2], ...]
  const addEdge = (i1, j1, i2, j2) => {
    const key = `${i1},${j1}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push([i2, j2]);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!isFilled(i, j)) continue;
      if (!isFilled(i, j - 1)) addEdge(i, j, i + 1, j);
      if (!isFilled(i + 1, j)) addEdge(i + 1, j, i + 1, j + 1);
      if (!isFilled(i, j + 1)) addEdge(i + 1, j + 1, i, j + 1);
      if (!isFilled(i - 1, j)) addEdge(i, j + 1, i, j);
    }
  }

  let bestLoop = null;
  let bestArea = 0;
  for (const startKey of [...edges.keys()]) {
    while (edges.get(startKey)?.length) {
      const loop = [];
      let key = startKey;
      while (edges.get(key)?.length) {
        const [i, j] = key.split(",").map(Number);
        loop.push({ x: xs[i], y: ys[j] });
        const [i2, j2] = edges.get(key).pop();
        key = `${i2},${j2}`;
        if (key === startKey) break;
      }
      const area = Math.abs(getSignedArea(loop));
      if (area > bestArea) {
        bestArea = area;
        bestLoop = loop;
      }
    }
  }
  return bestLoop ? removeCollinear(bestLoop) : null;
}

function getSignedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return sum / 2;
}

function removeCollinear(points) {
  const n = points.length;
  return points.filter((p, i) => {
    const prev = points[(i + n - 1) % n];
    const next = points[(i + 1) % n];
    return (
      (p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x) !== 0
    );
  });
}
