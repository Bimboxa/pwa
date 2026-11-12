import buildSectionGraph from "./buildSectionGraph.js";
import chainSectionGraph, { distanceToSegment } from "./chainSectionGraph.js";
import sectionTrianglesByPlane from "./sectionTrianglesByPlane.js";
import { dot } from "./vec3.js";

function distanceToPolyline(point, points) {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    best = Math.min(best, distanceToSegment(point, points[i], points[i + 1]));
  }
  return best;
}

// Cut lines of the « Plan de coupe » command: the section of the scene's
// triangle soup by every station plane, chained into polylines.
//
//   stations    = [{ point, normal }]      (getCutPlaneStations)
//   triangles   = [{ a, b, c, n }]         (collectSceneTriangles)
//   nearestOnly = keep, per plane, only the contour (connected component of
//                 the section) closest to the station point — drawn from
//                 inside a cylinder, the plane cuts that cylinder only.
//
// Returns [{ points, closed, stationIndex }] — world points, a closed line
// repeats its first point at the end.
export default function computeCutPlaneLines({
  stations,
  triangles,
  nearestOnly = false,
}) {
  const lines = [];
  (stations ?? []).forEach((station, stationIndex) => {
    const plane = {
      normal: station.normal,
      constant: dot(station.normal, station.point),
    };
    const segments = sectionTrianglesByPlane(plane, triangles);
    if (!segments.length) return;
    let chains = chainSectionGraph(buildSectionGraph(segments));
    if (nearestOnly && chains.length) {
      const distances = new Map();
      for (const chain of chains) {
        const d = distanceToPolyline(station.point, chain.points);
        const known = distances.get(chain.componentIndex);
        if (known === undefined || d < known) {
          distances.set(chain.componentIndex, d);
        }
      }
      let nearest = null;
      for (const [componentIndex, d] of distances) {
        if (!nearest || d < nearest.d) nearest = { componentIndex, d };
      }
      chains = chains.filter(
        (chain) => chain.componentIndex === nearest.componentIndex
      );
    }
    for (const chain of chains) {
      lines.push({ points: chain.points, closed: chain.closed, stationIndex });
    }
  });
  return lines;
}
