import getAnnotationVertices from "./getAnnotationVertices";

// Return the ids of annotations that have at least one vertex inside the given
// selection rectangle (local pixel coords). Vertex-based so a lasso drawn in the
// "encoche" (notch) of a concave shape doesn't catch it via its bbox.
export default function getAnnotationIdsInBox(annotations, selectionBox) {
  if (!Array.isArray(annotations) || !selectionBox) return [];

  const inBox = (pt) =>
    pt &&
    pt.x >= selectionBox.x &&
    pt.x <= selectionBox.x + selectionBox.width &&
    pt.y >= selectionBox.y &&
    pt.y <= selectionBox.y + selectionBox.height;

  const ids = [];
  annotations.forEach((ann) => {
    const verts = getAnnotationVertices(ann);
    if (verts.some(inBox)) ids.push(ann.id);
  });
  return ids;
}
