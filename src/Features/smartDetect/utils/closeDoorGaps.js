/**
 * Door detection for the « Pièce » drawing tool — see buildWallLineMasks.js.
 *
 * A door is drawn as a GAP in a wall plus the SWING ARC of its leaf: a
 * quarter circle centred on the hinge (one end of the gap), whose radius is
 * the width of the gap, running from the other end of the gap to the open
 * leaf. Double doors have two arcs of half the width, one per end.
 *
 *   1. Every wall line is scanned for gaps: a wall run ends and another wall
 *      cell (same line, or a perpendicular wall) is met between `minDoorM`
 *      and `maxDoubleDoorM` further.
 *   2. For each gap, the possible swing arcs (hinge at either end, either
 *      side of the wall, single or double) are sampled in the raw ink: a gap
 *      is a door when a thin stroke follows one of them over at least
 *      `arcCoverage` of its length, spread along it (dashed arcs pass; a
 *      text or a wall crossing the circle does not).
 *   3. A door gap is CLOSED in the wall mask (the wall is continuous there:
 *      a room stops at its doors, whatever their width or position), along
 *      with the same gap on the neighbouring lines of the wall thickness.
 *      The open leaf, when it was read as a wall line, is erased.
 *
 * Gaps without arc (free passages, corridor mouths) are left open.
 *
 * Works in grid cells, mutates `maskH` / `maskV`; tolerances in metres.
 *
 * @returns {Array<{axis:"h"|"v", line:number, start:number, end:number}>}
 *   The verified door gaps: cells [start, end) of the line.
 */
export default function closeDoorGaps({
  ink,
  maskH,
  maskV,
  width,
  height,
  meterByCell,
  minDoorM = 0.5,
  maxDoorM = 1.5,
  maxDoubleDoorM = 2.4,
  arcToleranceM = 0.04,
  arcClearanceM = 0.08,
  arcCoverage = 0.35,
  wallThicknessM = 0.5,
}) {
  const toCells = (meters) => Math.max(1, Math.round(meters / meterByCell));
  const minDoor = toCells(minDoorM);
  const maxDoor = toCells(maxDoorM);
  const maxGap = toCells(maxDoubleDoorM);
  const tolerance = toCells(arcToleranceM);
  const thickness = toCells(wallThicknessM);
  const clearance = Math.max(tolerance + 2, toCells(arcClearanceM));

  const isInside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  // one pass per axis; (t, line) -> (x, y)
  const axes = [
    {
      axis: "h",
      own: maskH,
      other: maskV,
      lineCount: height,
      lineLength: width,
      toXY: (t, line) => [t, line],
    },
    {
      axis: "v",
      own: maskV,
      other: maskH,
      lineCount: width,
      lineLength: height,
      toXY: (t, line) => [line, t],
    },
  ];

  const doors = [];

  for (const { axis, own, other, lineCount, lineLength, toXY } of axes) {
    // cell index without allocation: "h" lines are rows, "v" lines columns
    const stepStride = axis === "h" ? 1 : width;
    const lineStride = axis === "h" ? width : 1;
    const index = (t, line) => t * stepStride + line * lineStride;
    const isOwn = (t, line) =>
      t >= 0 && t < lineLength && line >= 0 && line < lineCount
        ? own[index(t, line)] === 1
        : false;
    // wall cell closing a gap: the same line (+/- 1), or a perpendicular wall
    const isStop = (t, line) => {
      for (let d = -1; d <= 1; d++) {
        const l = line + d;
        if (l < 0 || l >= lineCount) continue;
        if (own[index(t, l)] || other[index(t, l)]) return true;
      }
      return false;
    };

    // Is there a swing arc? Hinge at `hinge` (t), the gap running towards
    // `dirT`, the leaf opening on the side `side` of the wall. A sample of
    // the quarter circle counts when it carries ink at the radius (+/- the
    // tolerance) and none a bit inside nor a bit outside: a thin stroke that
    // follows the circle — not a text, a hatch or a wall the circle merely
    // crosses. The stroke must be spread along the arc (3 quarters of it at
    // least) and cover `arcCoverage` of it (dashed arcs pass).
    const hasSwingArc = (hinge, line, radius, dirT, side) => {
      const hasInkAt = (theta, rho) => {
        const [x, y] = toXY(
          Math.round(hinge + dirT * rho * Math.cos(theta)),
          Math.round(line + side * rho * Math.sin(theta))
        );
        return isInside(x, y) && ink[y * width + x] === 1;
      };
      const samples = Math.max(8, Math.round((radius * Math.PI) / 2));
      const sectors = [0, 0, 0, 0];
      const sectorTotals = [0, 0, 0, 0];
      let hits = 0;
      let total = 0;
      // the ends of the arc touch the wall and the leaf: skip them
      const margin = 0.2;
      const sweep = Math.PI / 2 - 2 * margin;
      for (let i = 0; i <= samples; i++) {
        const theta = margin + (i / samples) * sweep;
        let onArc = false;
        for (let d = -tolerance; d <= tolerance && !onArc; d++) {
          onArc = hasInkAt(theta, radius + d);
        }
        let isThin = true;
        for (const rho of [radius - clearance, radius + clearance]) {
          for (let d = -1; d <= 1 && isThin; d++) {
            if (hasInkAt(theta, rho + d)) isThin = false;
          }
        }
        const sector = Math.min(3, Math.floor((i / (samples + 1)) * 4));
        sectorTotals[sector]++;
        total++;
        if (onArc && isThin) {
          hits++;
          sectors[sector]++;
        }
      }
      if (hits < arcCoverage * total) return false;
      const spread = sectors.filter(
        (count, k) => count >= 0.2 * sectorTotals[k]
      ).length;
      return spread >= 3;
    };

    // { hinges: [{ hinge, dirT, side, radius }] } when the gap is a door
    const verifyDoor = (line, start, end) => {
      const gap = end - start;
      for (const side of [1, -1]) {
        if (gap <= maxDoor) {
          for (const [hinge, dirT] of [
            [start - 0.5, 1],
            [end - 0.5, -1],
          ]) {
            if (hasSwingArc(hinge, line, gap, dirT, side)) {
              return [{ hinge, dirT, side, radius: gap }];
            }
          }
        }
      }
      // double door: two leaves of half the width
      if (gap >= 2 * minDoor) {
        const radius = gap / 2;
        const leaves = [];
        for (const [hinge, dirT] of [
          [start - 0.5, 1],
          [end - 0.5, -1],
        ]) {
          const side = [1, -1].find((s) =>
            hasSwingArc(hinge, line, radius, dirT, s)
          );
          if (side) leaves.push({ hinge, dirT, side, radius });
        }
        if (leaves.length === 2) return leaves;
      }
      return null;
    };

    // --- 1. gaps
    const gaps = [];
    for (let line = 0; line < lineCount; line++) {
      for (let t = 1; t < lineLength; t++) {
        if (!isOwn(t - 1, line) || isOwn(t, line)) continue;
        // a wall run ends at t - 1
        let end = -1;
        for (let u = t; u < lineLength && u - t <= maxGap; u++) {
          if (isStop(u, line)) {
            end = u;
            break;
          }
        }
        if (end < 0 || end - t < minDoor) continue;
        gaps.push({ line, start: t, end, leaves: null });
        t = end;
      }
      // gaps between a perpendicular wall and the start of a wall run (door
      // next to a corner): scanned backwards from the run start
      for (let t = lineLength - 2; t >= 0; t--) {
        if (!isOwn(t + 1, line) || isOwn(t, line)) continue;
        let stop = -1;
        for (let u = t; u >= 0 && t - u <= maxGap; u--) {
          if (isStop(u, line)) {
            stop = u;
            break;
          }
        }
        if (stop < 0 || t - stop < minDoor) continue;
        // between two runs of the line: already found by the forward scan
        if (isOwn(stop, line)) continue;
        gaps.push({ line, start: stop + 1, end: t + 1, leaves: null });
        t = stop;
      }
    }

    // --- 2. swing arcs
    for (const gap of gaps) {
      gap.leaves = verifyDoor(gap.line, gap.start, gap.end);
    }
    // the same gap on the other lines of the wall thickness is a door too
    const verified = gaps.filter((gap) => gap.leaves);
    for (const gap of gaps) {
      if (gap.leaves) continue;
      gap.isSibling = verified.some(
        (door) =>
          Math.abs(door.line - gap.line) <= thickness &&
          Math.abs(door.start - gap.start) <= tolerance + 1 &&
          Math.abs(door.end - gap.end) <= tolerance + 1
      );
    }

    // --- 3. close the gaps, erase the leaves
    for (const gap of gaps) {
      if (!gap.leaves && !gap.isSibling) continue;
      for (let t = gap.start; t < gap.end; t++) own[index(t, gap.line)] = 1;
      doors.push({ axis, line: gap.line, start: gap.start, end: gap.end });

      for (const { hinge, side, radius } of gap.leaves ?? []) {
        // the open leaf: a line of the perpendicular mask leaving the hinge,
        // about `radius` long (shorter or longer: something else, kept)
        const hingeT = Math.round(hinge);
        const length = Math.round(radius);
        for (let d = -tolerance; d <= tolerance; d++) {
          const t = hingeT + d;
          if (t < 0 || t >= lineLength) continue;
          let last = 0;
          for (let k = 1; k <= length + 4 * tolerance; k++) {
            const l = gap.line + side * k;
            if (l < 0 || l >= lineCount) break;
            if (other[index(t, l)]) last = k;
            else if (k - last > thickness) break;
          }
          if (last < 0.6 * length || last > length + 2 * tolerance) continue;
          for (let k = 1; k <= last; k++) {
            other[index(t, gap.line + side * k)] = 0;
          }
        }
      }
    }
  }

  return doors;
}
