/**
 * Wall-line masks of a raster floor plan, for the « Pièce » drawing tool
 * (see detectRoomAtPoint.js).
 *
 * The image is binarised (dark = ink), resampled in the ortho frame, then only
 * the LONG, SOLID straight strokes are kept:
 *   - maskH: ink of the horizontal runs of at least `minRunM`
 *   - maskV: same, vertical
 * Text, door arcs, hatching and symbols are made of short runs and vanish.
 * Dashed and dash-dot lines (axes, hidden edges) are dropped whatever the
 * length of their dashes: a run with a small BLANK gap (<= `dashGapM`, no
 * stroke crossing the line there) to a neighbour on both sides is a dash. Coloured strokes (axes, networks…) are
 * dropped too when `ignoreColoredLines` is set. Doors (a gap in a wall with
 * the swing arc of its leaf) are closed: the wall is continuous there.
 *
 * The masks are returned as prefix sums, so that the coverage of any ortho
 * segment by wall cells is an O(1) lookup:
 *   - vCount[x * (height + 1) + y]: wall cells of column x in rows [0, y)
 *   - hCount[y * (width + 1) + x]: wall cells of row y in columns [0, x)
 *   - vWide / hWide: same, each line widened by `lineToleranceM` on both
 *     sides — the two faces of a thin wall, or wall bits that are not exactly
 *     aligned, read as one line.
 *
 * Pure function, node-testable. Every tolerance is in METRES; the grid is in
 * cells (1 cell = `scale` image px = `meterByCell` m, in the rotated frame).
 *
 * @param {Object} params
 * @param {{width:number,height:number,data:Uint8ClampedArray}} params.imageData
 * @param {number} params.meterByImagePx Metres per source-image pixel.
 * @param {{x:number,y:number,width:number,height:number}} [params.roi]
 *   Region to analyse, image px (default: the whole image).
 * @param {{center:{x:number,y:number},width:number,height:number}} [params.frameWindow]
 *   Computation window: a rectangle of the ortho frame (centre and sizes in
 *   image px). Only this part of the plan is analysed — everything outside
 *   reads as blank — which keeps the build fast enough to follow the cursor.
 * @param {number} [params.angleRad=0] Direction of the frame X axis in the
 *   image (walls are expected along / across it).
 * @param {number} [params.minRunM=0.3] Minimum stroke length kept.
 * @param {number} [params.bridgeGapM=0.02] Holes bridged inside a stroke.
 * @param {number} [params.dashGapM=0.4] Largest gap between two dashes.
 * @param {number} [params.crossingProbeM=0.05] Distance beside a line where
 *   a crossing stroke is looked for: a gap with ink around it is a wall
 *   intersection, not a dash gap.
 * @param {number} [params.lineToleranceM=0.05] Half-width of a "wide" line.
 * @param {boolean} [params.ignoreColoredLines=false]
 * @param {boolean} [params.detectDoors=true] Close the wall gaps that carry a
 *   door swing arc (closeDoorGaps.js): a room stops at its doors.
 * @param {Uint8Array} [params.exclusionMask] One byte per source-image pixel,
 *   > 0 where an existing annotation covers the plan (buildExclusionMask):
 *   those areas are read as solid, so a room never spreads under them.
 * @param {{x:number,y:number,width:number,height:number}} [params.exclusionRect]
 *   Image rectangle (integer px) the exclusion mask covers (default: the
 *   whole image).
 * @param {number} [params.darknessThreshold=160] Luminance (0..255) below = ink.
 * @param {number} [params.saturationThreshold=60] Channel spread (0..255)
 *   above = coloured.
 * @param {number} [params.maxCells=6e6] Grid size cap (drives `scale`).
 */

import closeDoorGaps from "./closeDoorGaps.js";
import { getBrightness } from "./stripDetectionHelpers.js";

// A chain of runs separated by small gaps is a dashed line from this count.
const MIN_DASH_CHAIN = 4;

export default function buildWallLineMasks({
  imageData,
  meterByImagePx,
  roi,
  frameWindow = null,
  angleRad = 0,
  minRunM = 0.3,
  bridgeGapM = 0.02,
  dashGapM = 0.4,
  crossingProbeM = 0.05,
  lineToleranceM = 0.05,
  ignoreColoredLines = false,
  detectDoors = true,
  exclusionMask = null,
  exclusionRect = null,
  darknessThreshold = 160,
  saturationThreshold = 60,
  maxCells = 6e6,
}) {
  const area = roi ?? {
    x: 0,
    y: 0,
    width: imageData.width,
    height: imageData.height,
  };
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // frame extents: the given window, else the bbox of the ROI rotated by
  // -angle around its centre
  const frameW =
    frameWindow?.width ??
    Math.abs(area.width * cos) + Math.abs(area.height * sin);
  const frameH =
    frameWindow?.height ??
    Math.abs(area.width * sin) + Math.abs(area.height * cos);
  const scale = Math.max(1, Math.ceil(Math.sqrt((frameW * frameH) / maxCells)));
  const width = Math.max(1, Math.ceil(frameW / scale));
  const height = Math.max(1, Math.ceil(frameH / scale));
  const meterByCell = meterByImagePx * scale;
  const toCells = (meters) => Math.round(meters / meterByCell);

  const cx = frameWindow?.center.x ?? area.x + area.width / 2;
  const cy = frameWindow?.center.y ?? area.y + area.height / 2;
  const gx = (width * scale) / 2;
  const gy = (height * scale) / 2;

  // frame (cells) -> image px, and back
  const toImagePx = ({ x, y }) => {
    const u = x * scale - gx;
    const v = y * scale - gy;
    return { x: cx + u * cos - v * sin, y: cy + u * sin + v * cos };
  };
  const fromImagePx = ({ x, y }) => {
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: (dx * cos + dy * sin + gx) / scale,
      y: (-dx * sin + dy * cos + gy) / scale,
    };
  };

  // --- 1. binarise in the frame (a cell is ink if any of its samples is)
  const bin = new Uint8Array(width * height);
  const x0 = Math.max(0, Math.floor(area.x));
  const y0 = Math.max(0, Math.floor(area.y));
  const x1 = Math.min(imageData.width, Math.ceil(area.x + area.width));
  const y1 = Math.min(imageData.height, Math.ceil(area.y + area.height));
  const { data } = imageData;

  const maskRect = exclusionRect ?? {
    x: 0,
    y: 0,
    width: imageData.width,
    height: imageData.height,
  };
  const isExcluded = (px, py) => {
    if (!exclusionMask) return false;
    const mx = px - maskRect.x;
    const my = py - maskRect.y;
    if (mx < 0 || my < 0 || mx >= maskRect.width || my >= maskRect.height) {
      return false;
    }
    return exclusionMask[my * maskRect.width + mx] > 0;
  };
  const isInk = (px, py) => {
    if (px < x0 || py < y0 || px >= x1 || py >= y1) return false;
    // an area already covered by an annotation is solid: its outline bounds
    // the rooms next to it
    if (isExcluded(px, py)) return true;
    const i = (py * imageData.width + px) * 4;
    if (data[i + 3] < 128) return false;
    if (getBrightness(imageData, px, py) >= darknessThreshold) return false;
    if (!ignoreColoredLines) return true;
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    return max - min < saturationThreshold;
  };
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      let ink = false;
      for (let b = 0; b < scale && !ink; b++) {
        for (let a = 0; a < scale && !ink; a++) {
          const u = i * scale + a + 0.5 - gx;
          const v = j * scale + b + 0.5 - gy;
          ink = isInk(
            Math.floor(cx + u * cos - v * sin),
            Math.floor(cy + u * sin + v * cos)
          );
        }
      }
      if (ink) bin[j * width + i] = 1;
    }
  }

  // --- 2. keep the long solid runs only
  const runOptions = {
    minRun: Math.max(2, toCells(minRunM)),
    bridgeGap: Math.max(1, toCells(bridgeGapM)),
    dashGap: toCells(dashGapM),
    // distance beside a line where a crossing stroke is looked for: beyond
    // the thickness of the line itself
    probe: Math.max(3, toCells(crossingProbeM)),
  };
  const maskH = new Uint8Array(width * height);
  const maskV = new Uint8Array(width * height);
  keepWallRuns(bin, maskH, width, height, 1, width, runOptions);
  keepWallRuns(bin, maskV, height, width, width, 1, runOptions);

  // --- 2b. doors: a gap with a swing arc is a door, the wall is continuous
  // there (see closeDoorGaps)
  const doors = detectDoors
    ? closeDoorGaps({ ink: bin, maskH, maskV, width, height, meterByCell })
    : [];

  // --- 3. prefix sums along the lines, raw and widened across the line
  const wide = Math.max(1, toCells(lineToleranceM));
  const vCount = new Uint16Array(width * (height + 1));
  const vWide = new Uint16Array(width * (height + 1));
  for (let x = 0; x < width; x++) {
    const base = x * (height + 1);
    const xa = Math.max(0, x - wide);
    const xb = Math.min(width - 1, x + wide);
    for (let y = 0; y < height; y++) {
      let on = 0;
      for (let k = xa; k <= xb && !on; k++) on = maskV[y * width + k];
      vWide[base + y + 1] = vWide[base + y] + on;
      vCount[base + y + 1] = vCount[base + y] + maskV[y * width + x];
    }
  }
  const hCount = new Uint16Array(height * (width + 1));
  const hWide = new Uint16Array(height * (width + 1));
  for (let y = 0; y < height; y++) {
    const base = y * (width + 1);
    const ya = Math.max(0, y - wide);
    const yb = Math.min(height - 1, y + wide);
    for (let x = 0; x < width; x++) {
      let on = 0;
      for (let k = ya; k <= yb && !on; k++) on = maskH[k * width + x];
      hWide[base + x + 1] = hWide[base + x] + on;
      hCount[base + x + 1] = hCount[base + x] + maskH[y * width + x];
    }
  }

  return {
    width,
    height,
    scale,
    meterByCell,
    wide,
    doors,
    vCount,
    hCount,
    vWide,
    hWide,
    toImagePx,
    fromImagePx,
    // ink darkness (0 = white .. 255 = black) at the centre of a cell — used
    // to tell the anti-aliased fringe of a wall from the wall itself
    getDarknessAt: (cellX, cellY) => {
      const u = (cellX + 0.5) * scale - gx;
      const v = (cellY + 0.5) * scale - gy;
      const px = Math.floor(cx + u * cos - v * sin);
      const py = Math.floor(cy + u * sin + v * cos);
      if (px < x0 || py < y0 || px >= x1 || py >= y1) return 0;
      if (isExcluded(px, py)) return 255;
      if (data[(py * imageData.width + px) * 4 + 3] < 128) return 0;
      return 255 - getBrightness(imageData, px, py);
    },
    // is this source-image position under an existing annotation?
    isExcludedAt: ({ x, y }) => {
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || py < 0 || px >= imageData.width || py >= imageData.height)
        return false;
      return isExcluded(px, py);
    },
  };
}

/**
 * Copy into `out` the ink cells of `bin` that belong to a wall run along one
 * axis: at least `minRun` cells (holes up to `bridgeGap` bridged), and not a
 * dash. Lines are indexed `line * lineStride + t * stepStride`.
 */
function keepWallRuns(
  bin,
  out,
  lineLength,
  lineCount,
  stepStride,
  lineStride,
  { minRun, bridgeGap, dashGap, probe }
) {
  for (let line = 0; line < lineCount; line++) {
    const base = line * lineStride;

    // runs of the line: [start, end] (inclusive)
    const runs = [];
    let start = -1;
    let last = -1;
    for (let t = 0; t < lineLength; t++) {
      if (bin[base + t * stepStride]) {
        if (start < 0) start = t;
        last = t;
      } else if (start >= 0 && t - last > bridgeGap) {
        runs.push([start, last]);
        start = -1;
      }
    }
    if (start >= 0) runs.push([start, last]);

    // Is the gap between two runs a dash gap? Not when a stroke crosses or
    // abuts the line there (ink beside the line, around the gap): a wall line
    // cut by the walls it meets is not a dashed line.
    const isBlankAround = (previousEnd, nextStart) => {
      for (const d of [-probe, probe]) {
        const other = line + d;
        if (other < 0 || other >= lineCount) continue;
        const otherBase = other * lineStride;
        const from = Math.max(0, previousEnd - 1);
        const to = Math.min(lineLength - 1, nextStart + 1);
        for (let t = from; t <= to; t++) {
          if (bin[otherBase + t * stepStride]) return false;
        }
      }
      return true;
    };

    // chains of runs separated by small blank gaps
    for (let i = 0; i < runs.length; ) {
      let j = i;
      while (
        j + 1 < runs.length &&
        runs[j + 1][0] - runs[j][1] - 1 <= dashGap &&
        isBlankAround(runs[j][1], runs[j + 1][0])
      ) {
        j++;
      }
      const isDashed = j - i + 1 >= MIN_DASH_CHAIN;
      // dashes = the inner runs; an end run is kept when it clearly stands
      // out (a solid wall line prolonged by a dashed one)
      let dashLength = 0;
      if (isDashed) {
        const inner = [];
        for (let k = i + 1; k < j; k++) inner.push(runs[k][1] - runs[k][0] + 1);
        inner.sort((p, q) => p - q);
        dashLength = inner[inner.length >> 1];
      }
      for (let k = i; k <= j; k++) {
        const [s, e] = runs[k];
        const length = e - s + 1;
        if (length < minRun) continue;
        if (isDashed) {
          const isEnd = k === i || k === j;
          if (!isEnd || length < 2 * dashLength) continue;
        }
        for (let t = s; t <= e; t++) {
          if (bin[base + t * stepStride]) out[base + t * stepStride] = 1;
        }
      }
      i = j + 1;
    }
  }
}
