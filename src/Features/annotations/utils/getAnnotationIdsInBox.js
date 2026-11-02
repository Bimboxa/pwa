import getAnnotationVertices from "./getAnnotationVertices";
import getAnnotationLassoSegments from "./getAnnotationLassoSegments";
import hitsLassoBox from "./hitsLassoBox";
import { getRectEdges } from "./segmentCrossesRect";
import { LASSO_MODE_CROSSING } from "Features/mapEditorGeneric/utils/lassoMode";

// Return the ids of annotations caught by a lasso rectangle (local pixel
// coords). `context`:
//   - meterByPx: forwarded to getAnnotationVertices so RULER / COTE rows are
//     also caught by their dimension line and value cards.
//   - mode (LASSO_MODE_WINDOW | LASSO_MODE_CROSSING, default CROSSING — the
//     closest to the historical "any vertex inside" rule):
//       WINDOW   → every vertex of the annotation lies inside the rectangle;
//       CROSSING → a vertex lies inside OR an edge crosses the rectangle.
// See hitsLassoBox for the predicate itself.
export default function getAnnotationIdsInBox(
  annotations,
  selectionBox,
  context = {}
) {
  if (!Array.isArray(annotations) || !selectionBox) return [];
  const { mode = LASSO_MODE_CROSSING } = context;

  const ids = [];
  annotations.forEach((ann) => {
    const verts = getAnnotationVertices(ann, context);
    if (verts.length === 0) return;
    const edges =
      mode === LASSO_MODE_CROSSING ? getAnnotationLassoEdges(ann) : [];
    if (hitsLassoBox({ verts, edges, selectionBox, mode })) ids.push(ann.id);
  });
  return ids;
}

// Edges tested in CROSSING mode: the 4 sides of an IMAGE / RECTANGLE bbox,
// else the main ring (closed for POLYGON / closeLine) + cut rings. RULER /
// COTE ink (offset dimension line, cards) is only caught by its vertices.
function getAnnotationLassoEdges(annotation) {
  if (annotation.type === "IMAGE" || annotation.type === "RECTANGLE") {
    return annotation.bbox ? getRectEdges(annotation.bbox) : [];
  }
  return getAnnotationLassoSegments(annotation).map((s) => [s.p0, s.p1]);
}
