// Plan footprint of an annotation revolved around a REVOLUTION_AXIS: the
// horizontal projection of its lathe (disc / annulus / annular sector), in
// the PLAN base map's reference pixels. Pure, node-testable, no Dexie / React
// (relative imports on purpose — see getRevolutionFootprintRings.test.mjs).
//
// Geometry contract (shared with buildRevolutionMesh / getAnnotationQties):
//   - the arc lives on a VERTICAL base map; `arc.revolutionAxisPoints` (set by
//     useAnnotationsV2) is the lathe axis in THAT base map's pixels and only
//     mean(x) is load-bearing: a profile vertex revolves at radius
//       r = |p.x − axisX| · arcMeterByPx            (metres)
//   - S–C–S arcs of the profile are sampled exactly like the lathe, so a
//     curved segment can reach radii beyond its anchor points;
//   - hidden segments split the profile into runs, each run sweeping its own
//     annulus [rMin, rMax]; a segment crossing the axis brings rMin to 0;
//   - a SOLID revolution (shape3D.solid) ignores hidden segments: an open
//     profile is closed toward the axis (disc [0, rMax]), a closed one
//     revolves as a torus (annulus [rMin, rMax]);
//   - a POINT revolves as a circle LINE (no area): one ring, `isLine`;
//   - the sector of a PARTIAL revolution lives on the AXIS
//     (`partialRevolution`, `revolutionAngleStartDeg/EndDeg`, plan LOCAL
//     metre frame: y up, CCW from start to end — same convention as
//     getRevolutionAxisContourArcs);
//   - the 3D half-view is display-only and deliberately IGNORED: the
//     footprint is the full turn (or the explicit sector), like the quantities.
//
// Plan pixels of a plan-local angle ψ at radius r (y flipped, see
// revolutionAxisGlyph.angleToPx):
//   X = Cx + (r / planMeterByPx)·cos ψ      Y = Cy − (r / planMeterByPx)·sin ψ
import { expandArcsInPathWithHiddenMap } from "../../geometry/utils/arcSampling.js";

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const mod2Pi = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

// Sub-segments per S–C–S arc half — same density as the lathe builder.
const ARC_SAMPLES = 12;
// Ring tessellation: per full turn, and the floor for a thin sector.
export const SEGMENTS_PER_TURN = 72;
const MIN_SECTOR_SEGMENTS = 8;
// Below this radius (metres) an inner ring is a point: no hole.
const EPS_R = 1e-4;
// Closed-profile test (pixels): first ≈ last vertex.
const EPS_CLOSED_PX = 1e-6;

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter(
      ([lo, hi]) => Number.isFinite(lo) && Number.isFinite(hi) && hi > EPS_R
    )
    .map(([lo, hi]) => [Math.max(0, lo), hi])
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [lo, hi] of sorted) {
    const last = out[out.length - 1];
    if (last && lo <= last[1] + EPS_R) {
      last[1] = Math.max(last[1], hi);
    } else {
      out.push([lo, hi]);
    }
  }
  return out;
}

// [rMin, rMax] of a run of consecutive signed radii (metres). The run reaches
// the axis when two consecutive vertices sit on opposite sides of it.
function intervalOfRun(signedRadii) {
  let lo = Infinity;
  let hi = 0;
  for (let i = 0; i < signedRadii.length; i++) {
    const r = Math.abs(signedRadii[i]);
    if (r < lo) lo = r;
    if (r > hi) hi = r;
    if (i > 0 && signedRadii[i - 1] * signedRadii[i] < 0) lo = 0;
  }
  return [lo, hi];
}

/**
 * Radial extent swept by a revolved annotation, as merged [rMin, rMax]
 * intervals in metres (ascending, disjoint). Empty when nothing revolves.
 *
 * @param {Object} arc  pixel-resolved annotation with `revolutionAxisPoints`
 * @param {number} arcMeterByPx  scale of the arc's own base map
 */
export function getRevolutionRadiusIntervals(arc, arcMeterByPx) {
  const axisPts = arc?.revolutionAxisPoints;
  if (!axisPts?.length || !(arcMeterByPx > 0)) return [];
  const axisX = axisPts.reduce((s, p) => s + p.x, 0) / axisPts.length;
  const signed = (p) => (p.x - axisX) * arcMeterByPx;

  if (arc.type === "POINT") {
    const p = arc.point;
    if (!p || !Number.isFinite(p.x)) return [];
    const r = Math.abs(signed(p));
    return r > EPS_R ? [[r, r]] : [];
  }

  if (arc.type !== "POLYLINE" || !(arc.points?.length >= 2)) return [];

  const solid = arc.shape3D?.solid === true;
  const { points, hiddenSegmentsIdx } = expandArcsInPathWithHiddenMap(
    arc.points,
    ARC_SAMPLES,
    solid ? [] : (arc.hiddenSegmentsIdx ?? []),
    false
  );
  const radii = points.map(signed);

  if (solid) {
    const first = points[0];
    const last = points[points.length - 1];
    const closed =
      Math.hypot(first.x - last.x, first.y - last.y) < EPS_CLOSED_PX;
    const [lo, hi] = intervalOfRun(radii);
    return mergeIntervals([[closed ? lo : 0, hi]]);
  }

  const hidden = new Set(hiddenSegmentsIdx ?? []);
  const intervals = [];
  let run = [radii[0]];
  for (let i = 0; i < radii.length - 1; i++) {
    if (hidden.has(i)) {
      if (run.length >= 2) intervals.push(intervalOfRun(run));
      run = [radii[i + 1]];
    } else {
      run.push(radii[i + 1]);
    }
  }
  if (run.length >= 2) intervals.push(intervalOfRun(run));
  return mergeIntervals(intervals);
}

// Sector kept by the axis, in plan-local radians: null for a full turn.
function getAxisSector(axis) {
  if (!axis?.partialRevolution) return null;
  const start = (Number(axis.revolutionAngleStartDeg) || 0) * DEG;
  const span = mod2Pi((Number(axis.revolutionAngleEndDeg) || 0) * DEG - start);
  if (span <= 1e-9) return null;
  return { start, span };
}

/**
 * @param {Object} params
 * @param {Object} params.arc   pixel-resolved revolved annotation
 *   (`revolutionAxisPoints` resolved against ITS base map)
 * @param {Object} params.axis  the plan REVOLUTION_AXIS, `point` in plan px
 * @param {number} params.arcMeterByPx
 * @param {number} params.planMeterByPx
 * @returns {{rings: Array<Array<{x:number,y:number}>>, isLine: boolean,
 *   closed: boolean} | null}
 *   rings[0] is the main ring, the others are holes / extra rings (even-odd
 *   fill). `isLine`: a POINT circle (stroke only). `closed`: false only for
 *   the open arc of a POINT under a partial revolution.
 */
export default function getRevolutionFootprintRings({
  arc,
  axis,
  arcMeterByPx,
  planMeterByPx,
}) {
  const c = axis?.point;
  if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
  if (!(planMeterByPx > 0)) return null;

  const intervals = getRevolutionRadiusIntervals(arc, arcMeterByPx);
  if (intervals.length === 0) return null;

  const sector = getAxisSector(axis);
  const toPx = (rM, psi) => ({
    x: c.x + (rM / planMeterByPx) * Math.cos(psi),
    y: c.y - (rM / planMeterByPx) * Math.sin(psi),
  });

  // Full circle: N points, CCW in the plan-local frame, no repeated end.
  const circle = (rM) => {
    const pts = [];
    for (let i = 0; i < SEGMENTS_PER_TURN; i++) {
      pts.push(toPx(rM, (i / SEGMENTS_PER_TURN) * TWO_PI));
    }
    return pts;
  };
  // Open arc from start over `span`, N+1 points; `reverse` walks it back.
  const arcPts = (rM, reverse = false) => {
    const n = Math.max(
      MIN_SECTOR_SEGMENTS,
      Math.round((SEGMENTS_PER_TURN * sector.span) / TWO_PI)
    );
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = reverse ? n - i : i;
      pts.push(toPx(rM, sector.start + (t / n) * sector.span));
    }
    return pts;
  };

  const isLine = arc.type === "POINT";
  if (isLine) {
    const r = intervals[0][1];
    return sector
      ? { rings: [arcPts(r)], isLine, closed: false }
      : { rings: [circle(r)], isLine, closed: true };
  }

  const rings = [];
  for (const [rIn, rOut] of intervals) {
    const hasHole = rIn > EPS_R;
    if (!sector) {
      rings.push(circle(rOut));
      if (hasHole) rings.push(circle(rIn));
    } else {
      // Annular sector (or a pie slice through the centre), one closed ring.
      const ring = arcPts(rOut);
      if (hasHole) ring.push(...arcPts(rIn, true));
      else ring.push({ x: c.x, y: c.y });
      rings.push(ring);
    }
  }
  return { rings, isLine, closed: true };
}
