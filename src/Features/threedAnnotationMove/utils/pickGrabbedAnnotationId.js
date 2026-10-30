import { isForeignFootprintId } from "../../annotations/constants/foreignFootprint.js";

import { isPointBasedAnnotationType } from "./annotationTransformTypes.js";

// The annotation a move/rotate grab click picks — shared by the 2D tool and
// the 3D tools (Déplacer / Tourner).
// A selection made before arming the tool is what the tool carries: the
// clicked point is only the anchor (or the pivot) — it must not hand the
// gesture over to another annotation that happens to share that point (two
// polygons sharing a vertex, say). So, when the selection holds carriable
// annotations: the snapped annotation if it belongs to the selection, else
// the first carriable selected one. Without a carriable selection: the
// snapped annotation (null when the click landed on none).
// `annotations`: the resolved annotations list; `isCarriableType`: the type
// filter of the tool (3D point-based list by default, the wider 2D one for
// the 2D tool).
export default function pickGrabbedAnnotationId({
  snapAnnotationId,
  selectedItems,
  annotations,
  isCarriableType = isPointBasedAnnotationType,
}) {
  const selectedIds = (selectedItems ?? [])
    .filter((i) => i.type === "NODE" && i.nodeType === "ANNOTATION")
    .map((i) => i.nodeId ?? i.id);
  const selectedCarriable = selectedIds.filter((id) => {
    if (isForeignFootprintId(id)) return false;
    const a = annotations?.find((ann) => ann.id === id);
    return Boolean(a) && isCarriableType(a.type);
  });
  if (!selectedCarriable.length) return snapAnnotationId ?? null;
  return selectedCarriable.includes(snapAnnotationId)
    ? snapAnnotationId
    : selectedCarriable[0];
}
