// Return the list of vertices of an annotation, in the same local pixel
// coordinate space as the resolved annotation.points (the space consumed by
// getAnnotationBbox). Used by the lasso hit-test to decide whether an
// annotation is selected based on its actual vertices rather than its bbox.
//
// Returns: [{ x, y }]
export default function getAnnotationVertices(annotation) {
  if (!annotation) return [];

  // 1. IMAGE / RECTANGLE: the 4 corners of the explicit bbox.
  if (annotation.type === "IMAGE" || annotation.type === "RECTANGLE") {
    const bbox = annotation.bbox;
    if (!bbox) return [];
    return [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x, y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    ];
  }

  // 2. POINT / MARKER / LABEL: the single point.
  if (annotation.point || annotation.targetPoint) {
    const pt = annotation.point || annotation.targetPoint;
    if (!pt || typeof pt.x !== "number") return [];
    return [{ x: pt.x, y: pt.y }];
  }

  // 3. POLYLINE / POLYGON: all main-ring points, plus the cut/hole vertices
  // so holes count too (consistent with getAnnotationLassoSegments).
  if (Array.isArray(annotation.points) && annotation.points.length > 0) {
    const verts = [];
    annotation.points.forEach((p) => {
      if (p && typeof p.x === "number") verts.push({ x: p.x, y: p.y });
    });
    (annotation.cuts || []).forEach((cut) => {
      (cut?.points || []).forEach((p) => {
        if (p && typeof p.x === "number") verts.push({ x: p.x, y: p.y });
      });
    });
    return verts;
  }

  return [];
}
