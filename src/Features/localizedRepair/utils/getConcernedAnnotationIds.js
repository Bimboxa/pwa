import getAnnotationVertices from "Features/annotations/utils/getAnnotationVertices";
import { segmentIntersection } from "Features/mesh/utils/meshGeometry";

// Return the ids of annotations "concerned" by a localized-repair selection
// rectangle. Superset of getAnnotationIdsInBox: an annotation is concerned when
//   - one of its vertices lies inside the rectangle, OR
//   - one of its segments crosses the rectangle, even with NO vertex inside
//     (e.g. a long wall passing straight through the selection — see the T-case
//     in the feature spec).
//
// All coordinates are in local pixel space (same as the resolved
// annotation.points / getAnnotationVertices output).
//
// `selectionRect` = { x, y, width, height }.
export default function getConcernedAnnotationIds(annotations, selectionRect) {
  if (!Array.isArray(annotations) || !selectionRect) return [];

  const { x, y, width, height } = selectionRect;
  const rx0 = x;
  const ry0 = y;
  const rx1 = x + width;
  const ry1 = y + height;

  const inRect = (p) =>
    p && p.x >= rx0 && p.x <= rx1 && p.y >= ry0 && p.y <= ry1;

  // The 4 edges of the selection rectangle.
  const tl = { x: rx0, y: ry0 };
  const tr = { x: rx1, y: ry0 };
  const br = { x: rx1, y: ry1 };
  const bl = { x: rx0, y: ry1 };
  const rectEdges = [
    [tl, tr],
    [tr, br],
    [br, bl],
    [bl, tl],
  ];

  const segmentCrossesRect = (a, b) => {
    if (inRect(a) || inRect(b)) return true;
    for (const [e0, e1] of rectEdges) {
      if (segmentIntersection(a, b, e0, e1)) return true;
    }
    return false;
  };

  const ids = [];
  for (const ann of annotations) {
    if (!ann) continue;
    // Only polyline-family annotations carry repairable segment geometry.
    if (!Array.isArray(ann.points) || ann.points.length === 0) continue;

    const verts = getAnnotationVertices(ann);
    if (verts.length === 0) continue;

    // Single point — vertex test only.
    if (verts.length === 1) {
      if (inRect(verts[0])) ids.push(ann.id);
      continue;
    }

    const isRing = ann.type === "POLYGON" || ann.closeLine === true;
    let concerned = false;
    for (let i = 0; i < verts.length - 1; i++) {
      if (segmentCrossesRect(verts[i], verts[i + 1])) {
        concerned = true;
        break;
      }
    }
    if (!concerned && isRing && verts.length >= 3) {
      concerned = segmentCrossesRect(verts[verts.length - 1], verts[0]);
    }
    if (concerned) ids.push(ann.id);
  }

  return ids;
}
