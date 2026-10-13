import { PICK_ANGULAR, PICK_MIN_M } from "./attachFatLineRaycast.js";

// Depth slack (m) within which a fat-line hit wins over a face hit sorted
// before it: twice the line's own picking tolerance (attachFatLineRaycast),
// since a line lying ON a face (flat POLYLINE without height drawn on a slab,
// a painted edge turned into a 2D annotation…) is hit at the closest point of
// its segment to the ray while the face is hit where the ray crosses it — the
// two distances tie within a few cm either way, and `intersectObjects`'
// distance sort would then pick the face as often as the line.
export function getLineWinTolerance(distance) {
  return 2 * Math.max(PICK_MIN_M, PICK_ANGULAR * distance);
}

const isLineObject = (object) =>
  Boolean(object?.isLine2 || object?.isLineSegments2);

// The annotation root (userData.nodeId) an object belongs to, or null.
function getAnnotationNodeId(object) {
  let current = object;
  while (current) {
    if (current.userData?.nodeId) return current.userData.nodeId;
    current = current.parent;
  }
  return null;
}

/**
 * Reorders a distance-sorted intersection list so that the first fat-line
 * hit (Line2 / LineSegments2 of an annotation, picked through
 * attachFatLineRaycast) comes first when it is at most
 * getLineWinTolerance(distance) behind the nearest face hit — a line drawn
 * on a face is a deliberate, thin target. The list is returned unchanged
 * when no line qualifies; the input array is never mutated.
 *
 * @param {Array<{distance: number, object: Object}>} intersects
 * @returns {Array} the same hits, the winning line (if any) moved first.
 */
export default function preferLineHits(intersects) {
  if (!Array.isArray(intersects) || intersects.length < 2) return intersects;
  if (isLineObject(intersects[0]?.object)) return intersects;

  const firstFace = intersects.find((hit) => !isLineObject(hit?.object));
  if (!firstFace) return intersects;

  const lineIndex = intersects.findIndex(
    (hit) =>
      isLineObject(hit?.object) && getAnnotationNodeId(hit.object) !== null
  );
  if (lineIndex < 0) return intersects;

  const line = intersects[lineIndex];
  const tolerance = getLineWinTolerance(line.distance);
  if (line.distance > firstFace.distance + tolerance) return intersects;

  const out = intersects.slice();
  out.splice(lineIndex, 1);
  out.unshift(line);
  return out;
}

export { getAnnotationNodeId, isLineObject };
