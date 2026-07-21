import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Toggles the type of ONE interior profileLine vertex between "square" and
// "circle". A "circle" vertex is an arc control point of the VERTICAL section
// curve (S-C-S convention, like plan arcs in NodePolylineStatic): the section
// passes through prev → vertex → next as a circular arc, and the 3D shell
// samples that arc. Constraints:
//   - endpoints stay "square" (contour anchors),
//   - a control point needs plain neighbors on both sides — toggling TO
//     "circle" is refused when an adjacent vertex is already "circle".
export default async function toggleProfileVertexTypeService({
  annotationId,
  profileIndex,
  vertexIndex,
  dispatch,
}) {
  if (
    !annotationId ||
    !Number.isInteger(profileIndex) ||
    !Number.isInteger(vertexIndex)
  ) {
    return;
  }

  const annotation = await db.annotations.get(annotationId);
  const line = annotation?.profileLines?.[profileIndex];
  const ref = line?.points?.[vertexIndex];
  if (!ref) return;
  if (vertexIndex === 0 || vertexIndex === line.points.length - 1) return;

  const isCircle = ref.type === "circle";
  if (!isCircle) {
    const prev = line.points[vertexIndex - 1];
    const next = line.points[vertexIndex + 1];
    if (prev?.type === "circle" || next?.type === "circle") return;
  }

  const profileLines = annotation.profileLines.map((l, i) =>
    i === profileIndex
      ? {
          ...l,
          points: l.points.map((r, j) =>
            j === vertexIndex
              ? { ...r, type: isCircle ? "square" : "circle" }
              : r
          ),
        }
      : l
  );

  await db.annotations.update(annotationId, { profileLines });
  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
