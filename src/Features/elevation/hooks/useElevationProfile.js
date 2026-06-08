import { useMemo } from "react";

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
    const seedA = points[seedSegmentIndex];
    const seedB = points[seedSegmentIndex + 1];
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

    let rawXs = [];
    let minRawX = Infinity;
    const built = chainPointIndices.map((pointIndex) => {
      const p = points[pointIndex];
      // observationSign mirrors the along-line axis (which side we view from);
      // the perpendicular planY is left unmirrored so it's a flip, not a rotation
      const rawX =
        observationSign * ((p.x - origin.x) * ux + (p.y - origin.y) * uy);
      const planY = (p.x - origin.x) * nx + (p.y - origin.y) * ny;
      rawXs.push(rawX);
      minRawX = Math.min(minRawX, rawX);

      const zTop = height + (p.offsetTop ?? 0) + offsetZ;
      const zBottom = (p.offsetBottom ?? 0) + offsetZ;
      return {
        pointIndex,
        rawX,
        topY: -zTop * pxPerMeter,
        bottomY: -zBottom * pxPerMeter,
        planY,
        zTop,
        zBottom,
      };
    });

    // shift so the left-most projected vertex sits at x = 0
    const vertices = built.map((v) => ({ ...v, x: v.rawX - minRawX }));

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
