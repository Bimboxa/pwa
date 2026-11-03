import sectionTrianglesByPlane from "./sectionTrianglesByPlane.js";
import buildSectionGraph, { locateOnGraph } from "./buildSectionGraph.js";
import walkCutLineTrace from "./walkCutLineTrace.js";
import { copy, cross, distanceSq, dot, normalize, sub } from "./vec3.js";

// Collinear points: the polygon's area is under this fraction of its extent
// squared (a 1 mm wide sliver over 1 m). Same threshold as computeDraftPlane.
const MIN_AREA_RATIO = 1e-3;

// Pure port of threedDrawing/utils/computeDraftPlane: plane of a polyline
// with 3+ non-collinear points, through its first point, Newell normal.
// Returns { point, normal } (plain objects) or null.
export function computeNewellPlane(points) {
  if (!points || points.length < 3) return null;
  const raw = { x: 0, y: 0, z: 0 };
  let extentSq = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    raw.x += (a.y - b.y) * (a.z + b.z);
    raw.y += (a.z - b.z) * (a.x + b.x);
    raw.z += (a.x - b.x) * (a.y + b.y);
    for (let j = i + 1; j < points.length; j++) {
      const d = distanceSq(a, points[j]);
      if (d > extentSq) extentSq = d;
    }
  }
  // |raw| = twice the polygon area.
  const twiceArea = Math.sqrt(dot(raw, raw));
  if (extentSq < 1e-12 || twiceArea / 2 < MIN_AREA_RATIO * extentSq) {
    return null;
  }
  const normal = normalize(raw);
  if (!normal) return null;
  return { point: copy(points[0]), normal };
}

// Outward direction of the end segment, skipping zero-length tail segments.
function endDirection(drawn, atEnd) {
  const tip = atEnd ? drawn[drawn.length - 1] : drawn[0];
  const step = atEnd ? -1 : 1;
  for (
    let i = (atEnd ? drawn.length - 1 : 0) + step;
    i >= 0 && i < drawn.length;
    i += step
  ) {
    const d = normalize(sub(tip, drawn[i]));
    if (d) return d;
  }
  return null;
}

// Cutting plane and walk inputs for one end of the drawn polyline, or null
// when that end cannot be extended (no face, degenerate direction, face
// parallel to the end segment).
//
//   { point, direction, faceNormal, plane: { normal, constant } }
export function describeCutLineEnd({ drawn, atEnd, face, polylinePlane }) {
  const faceNormal = normalize(face?.normal);
  if (!faceNormal || !Array.isArray(drawn) || drawn.length < 2) return null;
  const direction = endDirection(drawn, atEnd);
  if (!direction) return null;
  const point = copy(atEnd ? drawn[drawn.length - 1] : drawn[0]);

  let normal = polylinePlane?.normal ?? null;
  if (!normal) {
    normal = normalize(cross(direction, faceNormal));
    if (!normal) return null;
  }
  return {
    point,
    direction,
    faceNormal,
    plane: { normal, constant: dot(normal, point) },
  };
}

function samePlane(p, q, tolerance) {
  const s = dot(p.normal, q.normal);
  if (Math.abs(s) < 1 - 1e-9) return false;
  return Math.abs(p.constant - Math.sign(s) * q.constant) <= tolerance;
}

// Extend both ends of a drawn cut line along the faces met by its cutting
// plane (see walkCutLineTrace for the walk rules).
//
//   drawn     = [{x,y,z}] world, >= 2 points
//   startFace / endFace = { normal } | null — normal of the face under the
//               first / last vertex, pointing to the camera (outside). No face
//               → that end is not extended.
//   triangles = [{ a, b, c, n }] world triangles of the scene (outward n)
//
// Cutting plane: the polyline's own plane when it has 3+ non-collinear
// points (shared by both ends), otherwise per end the plane containing the
// end segment and the face normal.
//
// Returns { points, derivedStart, derivedEnd } with
//   points = [...reverse(startExtension), ...drawn, ...endExtension].
export default function extendCutLine({
  drawn,
  startFace = null,
  endFace = null,
  triangles = [],
  tolerance = 1e-3,
  maxPoints = 64,
}) {
  if (!Array.isArray(drawn) || drawn.length < 2) {
    return { points: drawn ?? [], derivedStart: 0, derivedEnd: 0 };
  }
  const polylinePlane = computeNewellPlane(drawn);
  const ends = [
    describeCutLineEnd({ drawn, atEnd: false, face: startFace, polylinePlane }),
    describeCutLineEnd({ drawn, atEnd: true, face: endFace, polylinePlane }),
  ];

  const walkEnd = (graph, end, key, visited) =>
    walkCutLineTrace(graph, {
      startKey: key,
      direction: end.direction,
      faceNormal: end.faceNormal,
      planeNormal: end.plane.normal,
      maxPoints,
      visited,
    });

  let extensions;
  const shared =
    ends[0] && ends[1] && samePlane(ends[0].plane, ends[1].plane, tolerance);
  if (shared) {
    // One graph, both ends inserted, one visited set: an extension that
    // reaches the other end (closed loop) stops there instead of looping.
    const graph = buildSectionGraph(
      sectionTrianglesByPlane(ends[0].plane, triangles),
      { tolerance }
    );
    const keys = ends.map((end) =>
      locateOnGraph(graph, end.point, end.direction, tolerance)
    );
    const visited = new Set(keys.filter(Boolean));
    extensions = ends.map((end, i) =>
      keys[i] ? walkEnd(graph, end, keys[i], visited) : []
    );
  } else {
    extensions = ends.map((end) => {
      if (!end) return [];
      const graph = buildSectionGraph(
        sectionTrianglesByPlane(end.plane, triangles),
        { tolerance }
      );
      const key = locateOnGraph(graph, end.point, end.direction, tolerance);
      return key ? walkEnd(graph, end, key, new Set()) : [];
    });
  }

  const [startExt, endExt] = extensions;
  return {
    points: [...startExt.slice().reverse(), ...drawn, ...endExt],
    derivedStart: startExt.length,
    derivedEnd: endExt.length,
  };
}
