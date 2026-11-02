import { makeInRect, makeSegmentCrossesRect } from "./segmentCrossesRect.js";
import { LASSO_MODE_WINDOW } from "../../mapEditorGeneric/utils/lassoMode.js";

// Pure lasso predicate — relative imports only so it stays unit-testable
// with `node --test` (see hitsLassoBox.test.mjs).
//
//   verts:        [{ x, y }] — the annotation vertices (never empty to hit)
//   edges:        [[p0, p1]] — the annotation edges (CROSSING mode only)
//   selectionBox: { x, y, width, height }
//   mode:         LASSO_MODE_WINDOW | LASSO_MODE_CROSSING
//
//   WINDOW   → every vertex lies inside the rectangle.
//   CROSSING → a vertex lies inside, or an edge has an endpoint inside /
//              crosses a side of the rectangle.
//
// Vertex / edge based rather than bbox based: a rectangle drawn in the
// "encoche" (notch) of a concave shape, touching no edge, catches nothing in
// either mode (its bbox would).
export default function hitsLassoBox({
  verts,
  edges = [],
  selectionBox,
  mode,
}) {
  if (!verts?.length || !selectionBox) return false;
  const inBox = makeInRect(selectionBox);
  if (mode === LASSO_MODE_WINDOW) return verts.every(inBox);
  if (verts.some(inBox)) return true;
  const crosses = makeSegmentCrossesRect(selectionBox);
  return edges.some(([p0, p1]) => p0 && p1 && crosses(p0, p1));
}
