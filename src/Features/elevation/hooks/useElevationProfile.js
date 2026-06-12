import { useMemo } from "react";

import {
  typeOf,
  circleFromThreePoints,
  sampleArcPoints,
} from "Features/geometry/utils/arcSampling";

// Builds the elevation geometry (in the editor's SVG world space) for the
// selected projectable chain. Both axes are expressed in map pixels:
//   - X = orthogonal projection of each chain point onto the line carried by
//         the selected (seed) segment — so that seed segment is horizontal
//   - Y = -(Z in meters) / meterByPx  (screen Y points down, so up = negative)
//
// Per the data model:
//   Z_top    = height + offsetTop  (+ global offsetZ)
//   Z_bottom = offsetBottom        (+ global offsetZ)
//
// The plan recap echo (`planY`) carries each vertex's signed perpendicular
// distance to the seed line, so the projected top-view reads above the
// elevation.
//
// Arcs (square → circle → square, S-C-S): a chain segment that is one half of
// an arc is sampled into intermediate points along the underlying circle, so
// the developed elevation and the "vue de dessus" recap follow the curve
// instead of collapsing onto the chord of its control points (same S-C-S model
// as NodePolylineStatic). Each vertex carries:
//   - `pointIndex`: original point index for real anchors, `null` for sampled
//     intermediate points (so handles / offset fields / grid lines only attach
//     to anchors).
//   - `segIndex`: the original segment index (start anchor's point index) of
//     the band STARTING at this vertex — used for band hover / selection /
//     highlight; `null` on the last vertex.
const ARC_SAMPLES = 12;
const lerp = (a, b, t) => a + (b - a) * t;

export default function useElevationProfile({
  points,
  selectedSegmentIndices,
  seedSegmentIndex,
  observationSign = 1,
  meterByPx,
  height,
  offsetZ,
}) {
  return useMemo(() => {
    const empty = { vertices: [], bbox: null, chainPointIndices: [] };

    if (
      !Array.isArray(points) ||
      points.length < 2 ||
      !Array.isArray(selectedSegmentIndices) ||
      selectedSegmentIndices.length === 0 ||
      !meterByPx
    ) {
      return empty;
    }

    // Ordered (possibly wrapping) chain of segments → ordered point indices.
    // Each segment s connects points[s] -> points[(s + 1) % n]; consecutive
    // segments share a vertex, so the point chain is the first segment's start
    // followed by every segment's end vertex. Do NOT sort — a closed chain like
    // [n-2, n-1, 0] would be reordered into a wrong contiguous range.
    const n = points.length;
    const segs = selectedSegmentIndices;
    const chainPointIndices = [segs[0]];
    for (const s of segs) chainPointIndices.push((s + 1) % n);
    if (chainPointIndices.some((i) => !points[i])) return empty;
    if (chainPointIndices.length < 2) return empty;

    const pxPerMeter = 1 / meterByPx;

    // projection line = the line carried by the selected (seed) segment. The
    // chain points are projected orthogonally onto it, so the seed segment is
    // horizontal in the editor. Fall back to the chain's first→last direction.
    // Wrap with % n so the CLOSURE segment (seedSegmentIndex === n-1, which
    // connects points[n-1] → points[0]) resolves its end vertex correctly —
    // otherwise points[n] is undefined and the seed direction silently falls
    // back to the chain's first→last vector (closure segment not horizontal).
    const seedA = points[seedSegmentIndex];
    const seedB = points[(seedSegmentIndex + 1) % n];
    let dx;
    let dy;
    if (
      seedA &&
      seedB &&
      Math.hypot(seedB.x - seedA.x, seedB.y - seedA.y) > 1e-9
    ) {
      dx = seedB.x - seedA.x;
      dy = seedB.y - seedA.y;
    } else {
      const a = points[chainPointIndices[0]];
      const b = points[chainPointIndices[chainPointIndices.length - 1]];
      dx = b.x - a.x;
      dy = b.y - a.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len; // unit direction of the projection line
    const uy = dy / len;
    const nx = -uy; // unit normal to the line
    const ny = ux;

    const origin = points[chainPointIndices[0]];

    // observationSign mirrors the along-line axis (which side we view from);
    // the perpendicular planY is left unmirrored so it's a flip, not a rotation.
    const projectX = (px, py) =>
      observationSign * ((px - origin.x) * ux + (py - origin.y) * uy);
    const projectPlanY = (px, py) =>
      (px - origin.x) * nx + (py - origin.y) * ny;

    const makeVertex = ({
      px,
      py,
      offsetTop,
      offsetBottom,
      pointIndex,
      segIndex,
    }) => {
      const zTop = height + (offsetTop ?? 0) + offsetZ;
      const zBottom = (offsetBottom ?? 0) + offsetZ;
      return {
        pointIndex,
        segIndex,
        px,
        py,
        rawX: projectX(px, py),
        topY: -zTop * pxPerMeter,
        bottomY: -zBottom * pxPerMeter,
        planY: projectPlanY(px, py),
        zTop,
        zBottom,
      };
    };

    // If the chain segment ia → ib is one half of an S-C-S arc, return the
    // underlying circle + winding so it can be sampled. ia / ib are adjacent
    // original point indices (the chain is contiguous).
    const arcForChainSegment = (ia, ib) => {
      const A = points[ia];
      const B = points[ib];
      if (!A || !B) return null;
      const tA = typeOf(A);
      const tB = typeOf(B);

      // first half: square A → circle B, followed by a square C
      if (tA !== "circle" && tB === "circle") {
        const C = points[(ib + 1) % n];
        if (C && typeOf(C) !== "circle") {
          const circ = circleFromThreePoints(A, B, C);
          if (circ && Number.isFinite(circ.r) && circ.r > 0) {
            const cross =
              (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
            return { circ, isCW: cross > 0 };
          }
        }
      }

      // second half: circle A → square B, preceded by a square P0
      if (tA === "circle" && tB !== "circle") {
        const P0 = points[(ia - 1 + n) % n];
        if (P0 && typeOf(P0) !== "circle") {
          const circ = circleFromThreePoints(P0, A, B);
          if (circ && Number.isFinite(circ.r) && circ.r > 0) {
            const cross =
              (A.x - P0.x) * (B.y - P0.y) - (A.y - P0.y) * (B.x - P0.x);
            return { circ, isCW: cross > 0 };
          }
        }
      }

      return null;
    };

    const raw = [];
    const L = chainPointIndices.length;
    for (let m = 0; m < L; m++) {
      const ia = chainPointIndices[m];
      const A = points[ia];
      const isLast = m === L - 1;
      const segIndex = isLast ? null : ia;

      raw.push(
        makeVertex({
          px: A.x,
          py: A.y,
          offsetTop: A.offsetTop,
          offsetBottom: A.offsetBottom,
          pointIndex: ia,
          segIndex,
        })
      );

      if (isLast) break;

      const ib = chainPointIndices[m + 1];
      const B = points[ib];
      const arc = arcForChainSegment(ia, ib);
      if (!arc) continue;

      // sampleArcPoints returns ARC_SAMPLES points ending at B; drop the last
      // (== B, which is pushed as the next anchor) and interpolate the offsets.
      const samples = sampleArcPoints(
        A,
        B,
        arc.circ.center,
        arc.circ.r,
        arc.isCW,
        ARC_SAMPLES
      );
      const tA = A.offsetTop ?? 0;
      const bA = A.offsetBottom ?? 0;
      const tB = B.offsetTop ?? 0;
      const bB = B.offsetBottom ?? 0;
      for (let k = 0; k < samples.length - 1; k++) {
        const f = (k + 1) / ARC_SAMPLES;
        raw.push(
          makeVertex({
            px: samples[k].x,
            py: samples[k].y,
            offsetTop: lerp(tA, tB, f),
            offsetBottom: lerp(bA, bB, f),
            pointIndex: null,
            segIndex,
          })
        );
      }
    }

    // shift so the left-most projected vertex sits at x = 0
    let minRawX = Infinity;
    for (const v of raw) minRawX = Math.min(minRawX, v.rawX);
    const vertices = raw.map((v) => ({ ...v, x: v.rawX - minRawX }));

    // bbox over the elevation body (top/bottom), used for fit-contain
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const v of vertices) {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.topY, v.bottomY);
      maxY = Math.max(maxY, v.topY, v.bottomY);
    }

    return {
      vertices,
      chainPointIndices,
      bbox: { minX, maxX, minY, maxY },
    };
  }, [
    points,
    selectedSegmentIndices,
    seedSegmentIndex,
    observationSign,
    meterByPx,
    height,
    offsetZ,
  ]);
}
