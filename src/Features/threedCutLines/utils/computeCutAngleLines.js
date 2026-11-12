import buildSectionGraph from "./buildSectionGraph.js";
import chainSectionGraph from "./chainSectionGraph.js";
import { keepNearestComponent } from "./computeCutPlaneLines.js";
import sectionTrianglesByPlane from "./sectionTrianglesByPlane.js";
import { distanceSq, dot, lerp, sub } from "./vec3.js";

const EPS = 1e-5;
// A line end within this of the rotation axis lies on it (meters).
const AXIS_TOLERANCE = 1e-4;

// Part of a section segment on the half-plane's side of the rotation axis
// (dot(p - origin, dir) ≥ 0): a segment crossing the axis is cut ON it, one
// fully behind it is dropped (null).
function clipSegmentToHalfPlane(segment, station) {
  const sa = dot(sub(segment.a, station.point), station.dir);
  const sb = dot(sub(segment.b, station.point), station.dir);
  if (sa <= EPS && sb <= EPS) return null;
  let { a, b } = segment;
  if (sa < -EPS) a = lerp(segment.a, segment.b, sa / (sa - sb));
  else if (sb < -EPS) b = lerp(segment.b, segment.a, sb / (sb - sa));
  if (distanceSq(a, b) <= EPS * EPS) return null;
  return { ...segment, a, b };
}

// Cut lines of the « Coupe par angle » command: the section of the scene's
// triangle soup by every station half-plane, chained into polylines. The
// lines of two half-planes are never joined: they only meet on the axis.
//
//   stations    = [{ point, dir, normal }]  (getCutAngleStations)
//   triangles   = [{ a, b, c, n }]          (collectSceneTriangles)
//   nearestOnly = keep, per half-plane, only the contour (connected
//                 component of the section) closest to the pivot.
//
// Returns [{ points, closed, stationIndex, stopAtEnd }] — world points, a
// closed line repeats its first point at the end; stopAtEnd: the last point
// of an open line sits on the axis.
export default function computeCutAngleLines({
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
    const segments = sectionTrianglesByPlane(plane, triangles)
      .map((segment) => clipSegmentToHalfPlane(segment, station))
      .filter(Boolean);
    if (!segments.length) return;
    let chains = chainSectionGraph(buildSectionGraph(segments));
    if (nearestOnly) chains = keepNearestComponent(chains, station.point);
    const onAxis = (p) =>
      Math.abs(dot(sub(p, station.point), station.dir)) <= AXIS_TOLERANCE;
    for (const chain of chains) {
      let { points } = chain;
      // An open line ending on the axis (inside a face, at the pivot the
      // rays share) is oriented to END there and flagged: the service
      // stores a « Stop » on that point, so a later re-extension of the
      // line never runs past the axis.
      let stopAtEnd = false;
      if (!chain.closed && points.length >= 2) {
        if (onAxis(points[points.length - 1])) stopAtEnd = true;
        else if (onAxis(points[0])) {
          points = [...points].reverse();
          stopAtEnd = true;
        }
      }
      lines.push({ points, closed: chain.closed, stationIndex, stopAtEnd });
    }
  });
  return lines;
}
