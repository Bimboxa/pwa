import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";

// Display clip of a painted part: a host shown as a display-only half
// (« Révolution partielle ») is painted over its WHOLE turn — the row and
// its quantities never depend on the view — and only the part lying on the
// displayed side is drawn / picked.
//
// clip: { point: V, normal: V } in base-map-local meters — the half-space
// dot(p - point, normal) ≥ 0 is displayed (see getHostHalfView). The cut
// runs along facet / segment boundaries (the hidden half is the displayed
// one turned by 180° about the axis): parts are kept or dropped whole, by
// their middle.
//
// Pure: node-testable.

const CLIP_EPS_M = 1e-4;

const side = (p, clip) =>
  (p.x - clip.point.x) * clip.normal.x +
  (p.y - clip.point.y) * clip.normal.y +
  (p.z - clip.point.z) * clip.normal.z;

function isLoopDisplayed(loop, clip) {
  let sum = 0;
  for (const p of loop) sum += side(p, clip);
  return sum / loop.length >= -CLIP_EPS_M;
}

export function isSegmentDisplayed(a, b, clip) {
  if (!clip) return true;
  return (side(a, clip) + side(b, clip)) / 2 >= -CLIP_EPS_M;
}

/**
 * Displayed part of a local geometry (null when nothing is left).
 * FACE → the same face with the displayed polygons only; EDGE → {segments:
 * [[a, b], …]} the displayed segments.
 */
export default function clipPaintGeometry(partType, localGeometry, clip) {
  if (!localGeometry) return null;
  if (partType === MESH_PAINT_PART_TYPES.FACE) {
    if (!clip) return localGeometry;
    const polygons = (localGeometry.polygons || []).filter(
      (polygon) =>
        polygon?.contour?.length >= 3 && isLoopDisplayed(polygon.contour, clip)
    );
    return polygons.length ? { ...localGeometry, polygons } : null;
  }
  const points = localGeometry.points || [];
  const segments = [];
  for (let i = 0; i + 1 < points.length; i++) {
    if (isSegmentDisplayed(points[i], points[i + 1], clip)) {
      segments.push([points[i], points[i + 1]]);
    }
  }
  return segments.length ? { segments } : null;
}

export const getClipKey = (clip) =>
  clip
    ? [clip.point, clip.normal]
        .map((v) => [v.x, v.y, v.z].map((n) => n.toFixed(4)).join(","))
        .join("/")
    : "";
