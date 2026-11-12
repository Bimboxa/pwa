import sectionTrianglesByPlane from "./sectionTrianglesByPlane.js";
import buildSectionGraph, {
  locateNodeNear,
  locateOnGraph,
} from "./buildSectionGraph.js";
import walkCutLineTrace from "./walkCutLineTrace.js";
import { copy, cross, distanceSq, dot, normalize, sub } from "./vec3.js";

// Surfaces the trace runs across are detected up to this distance (m): a
// free edge of a section bridges to the nearest node of another surface's
// section within it (user decision 2026-11-04: 2 cm).
export const CUT_LINE_GAP_TOLERANCE_M = 2e-2;

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

// The end segment runs INTO the face (rather than on it) when its direction
// is within this angle of the face normal: the line drawn on the plan arrives
// at the foot of a sheet / wall, whose face is the one under the cursor.
const COS_END_ON = Math.cos((15 * Math.PI) / 180);

// Cutting plane and walk inputs for one end of the drawn polyline, or null
// when that end cannot be extended (no face, degenerate direction, face
// parallel to the end segment).
//
//   { point, direction, faceNormal, plane: { normal, constant }, endOn }
//
// `upNormal` (optional): normal of the plan the line is drawn on (world).
// When the end segment runs into the face under the end vertex (an open sheet
// met edge-on — its normal is along the segment, so d × n is degenerate), the
// cutting plane is the vertical one through the segment (d × up) and the walk
// starts on the plan (face normal = up): `endOn` is true.
export function describeCutLineEnd({
  drawn,
  atEnd,
  face,
  polylinePlane,
  upNormal = null,
}) {
  let faceNormal = normalize(face?.normal);
  if (!faceNormal || !Array.isArray(drawn) || drawn.length < 2) return null;
  const direction = endDirection(drawn, atEnd);
  if (!direction) return null;
  const point = copy(atEnd ? drawn[drawn.length - 1] : drawn[0]);

  let normal = polylinePlane?.normal ?? null;
  let endOn = false;
  if (!normal) {
    const up = normalize(upNormal);
    if (up && Math.abs(dot(direction, faceNormal)) > COS_END_ON) {
      normal = normalize(cross(direction, up));
      if (!normal) return null;
      faceNormal = up;
      endOn = true;
    } else {
      normal = normalize(cross(direction, faceNormal));
      if (!normal) return null;
    }
  }
  return {
    point,
    direction,
    faceNormal,
    plane: { normal, constant: dot(normal, point) },
    endOn,
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
//   upNormal  = normal of the host plan (world), see describeCutLineEnd
//   maxPoints = cap on the simplified points added at each end
//   gapTolerance = distance (m) under which the trace bridges a free edge to
//               the section of another surface (the surfaces crossed by the
//               line are drawn independently: a slab edge following a sweep's
//               guide stops a few cm short of the sheet's foot), and under
//               which the start falls back to the nearest section node
//
// Cutting plane: the polyline's own plane when it has 3+ non-collinear
// points (shared by both ends), otherwise per end the plane containing the
// end segment and the face normal (or the plan normal when the segment runs
// into that face).
//
// Start of the walk: the section edge running along the end segment
// (locateOnGraph); when there is none — the line ends at the foot of a sheet
// standing on the plan, whose section leaves the end point sideways — the
// section node at the end point (locateNodeNear), the first step then free
// to be perpendicular to the drawn direction.
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
  upNormal = null,
  gapTolerance = CUT_LINE_GAP_TOLERANCE_M,
}) {
  if (!Array.isArray(drawn) || drawn.length < 2) {
    return { points: drawn ?? [], derivedStart: 0, derivedEnd: 0 };
  }
  // A closed line (« Plan de coupe »: the whole section of a solid, its
  // last point back on the first) has no end to extend.
  if (
    drawn.length > 2 &&
    distanceSq(drawn[0], drawn[drawn.length - 1]) <= tolerance * tolerance
  ) {
    return { points: drawn, derivedStart: 0, derivedEnd: 0 };
  }
  const polylinePlane = computeNewellPlane(drawn);
  const ends = [
    describeCutLineEnd({
      drawn,
      atEnd: false,
      face: startFace,
      polylinePlane,
      upNormal,
    }),
    describeCutLineEnd({
      drawn,
      atEnd: true,
      face: endFace,
      polylinePlane,
      upNormal,
    }),
  ];

  const locate = (graph, end) => {
    const key = locateOnGraph(graph, end.point, end.direction, tolerance);
    if (key) return { key, perpendicular: false };
    const near = locateNodeNear(
      graph,
      end.point,
      Math.max(tolerance * 10, gapTolerance)
    );
    return near ? { key: near, perpendicular: true } : null;
  };
  const walkEnd = (graph, end, start, visited) =>
    walkCutLineTrace(graph, {
      startKey: start.key,
      direction: end.direction,
      faceNormal: end.faceNormal,
      planeNormal: end.plane.normal,
      maxPoints,
      gapTolerance,
      allowPerpendicularStart: start.perpendicular,
      upNormal,
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
    const starts = ends.map((end) => locate(graph, end));
    const visited = new Set(starts.filter(Boolean).map((s) => s.key));
    extensions = ends.map((end, i) =>
      starts[i] ? walkEnd(graph, end, starts[i], visited) : []
    );
  } else {
    extensions = ends.map((end) => {
      if (!end) return [];
      const graph = buildSectionGraph(
        sectionTrianglesByPlane(end.plane, triangles),
        { tolerance }
      );
      const start = locate(graph, end);
      return start ? walkEnd(graph, end, start, new Set()) : [];
    });
  }

  const [startExt, endExt] = extensions;
  return {
    points: [...startExt.slice().reverse(), ...drawn, ...endExt],
    derivedStart: startExt.length,
    derivedEnd: endExt.length,
  };
}
