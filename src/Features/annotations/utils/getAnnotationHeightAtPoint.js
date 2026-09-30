import projectPointOnSegment from "./projectPointOnSegment";
import getGuideLineRampSampler from "./getGuideLineRampSampler";
import getPolygonZPlane, { getZAtXY } from "./getPolygonZPlane";

// Heights (metres above the base map plane) of a RESOLVED annotation under a
// point of the 2D editor: {bottom, top} — `top` only when the annotation has
// a vertical span there (wall, slab, sloped floor), else null.
//
// Same conventions as the 3D builders (triangulateAnnotationGeometry /
// extrudePolylineWall.cornerSpan):
//   bottom = offsetZ + offsetBottom
//   top    = offsetZ + height + offsetBottom + offsetTop
// Per-vertex offsets are interpolated along the nearest segment (lines) or
// over the ring (polygons: guideLine ramp sampler when the floor is ramped,
// else the least-squares plane of the vertex values).
//
// The relief of a scan base map is not handled here (see
// getScene3dHeightAtPx).
// annotation.points / guideLines are in px (resolved); point too.
// Returns null when the annotation carries no usable geometry.

const SPAN_EPS_M = 1e-3;

const LINE_TYPES = new Set([
  "POLYLINE",
  "STRIP",
  "RULER",
  "LINEAR_LAYOUT",
  "COTE",
  "BASE_MAP_LINK",
]);

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isXY(p) {
  return p && typeof p.x === "number" && typeof p.y === "number";
}

function finish(bottom, top) {
  return {
    bottom,
    top: top != null && top - bottom > SPAN_EPS_M ? top : null,
  };
}

// Nearest segment of the vertex list (closing segment when `closed`) and the
// per-vertex offsets interpolated at the foot of the perpendicular.
function interpolateOnSegments(points, point, closed) {
  const pts = points.filter(isXY);
  if (pts.length === 0) return null;
  if (pts.length === 1) {
    return {
      offsetBottom: num(pts[0].offsetBottom),
      offsetTop: num(pts[0].offsetTop),
    };
  }
  let best = null;
  const count = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const proj = projectPointOnSegment(point, a, b);
    if (!best || proj.distance < best.distance) best = { ...proj, a, b };
  }
  const { a, b, t } = best;
  return {
    offsetBottom:
      num(a.offsetBottom) + t * (num(b.offsetBottom) - num(a.offsetBottom)),
    offsetTop: num(a.offsetTop) + t * (num(b.offsetTop) - num(a.offsetTop)),
  };
}

function hasNonZero(points, key) {
  return points.some((p) => Math.abs(num(p?.[key])) > 1e-9);
}

export default function getAnnotationHeightAtPoint({
  annotation,
  point,
  meterByPx,
}) {
  if (!annotation || !isXY(point)) return null;
  const type = annotation.type;
  const offsetZ = num(annotation.offsetZ);
  const height = num(annotation.height);

  if (LINE_TYPES.has(type)) {
    const offsets = interpolateOnSegments(
      annotation.points || [],
      point,
      Boolean(annotation.closeLine)
    );
    if (!offsets) return finish(offsetZ, null);
    const bottom = offsetZ + offsets.offsetBottom;
    return finish(bottom, bottom + height + offsets.offsetTop);
  }

  if (type === "POLYGON") {
    const points = (annotation.points || []).filter(isXY);
    const bottomPlane = hasNonZero(points, "offsetBottom")
      ? getPolygonZPlane({ points, meterByPx, key: "offsetBottom" })
      : null;
    const offsetBottom = bottomPlane
      ? getZAtXY(bottomPlane, point.x, point.y, meterByPx)
      : 0;

    let offsetTop = 0;
    const guideLines = (annotation.guideLines || []).filter(
      (g) => g?.points?.length >= 2 && g?.slopePct && !g?.isStairs
    );
    if (guideLines.length > 0) {
      const ramp = getGuideLineRampSampler({
        guideLines,
        polygonPts: points,
        meterByPx,
      });
      if (ramp.ok) offsetTop = ramp.groundAt(point);
    } else if (hasNonZero(points, "offsetTop")) {
      const topPlane = getPolygonZPlane({
        points,
        meterByPx,
        key: "offsetTop",
      });
      if (topPlane) offsetTop = getZAtXY(topPlane, point.x, point.y, meterByPx);
    }

    const bottom = offsetZ + offsetBottom;
    return finish(bottom, bottom + height + offsetTop);
  }

  // POINT / MARKER / LABEL / DETAIL / IMAGE / OBJECT_3D / FREE_TEXT / …
  return finish(offsetZ, height > 0 ? offsetZ + height : null);
}
