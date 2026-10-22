// Id of the annotation selected ALONE (one NODE / ANNOTATION item), else
// null — a cote is highlighted (ThreedCoteAnnotations) and its value card
// draggable (useCoteLabelDragHandlers) only when it is that annotation.
export default function getSingleSelectedAnnotationId(items) {
  if (!items || items.length !== 1) return null;
  const it = items[0];
  if (it?.type !== "NODE" || it?.nodeType !== "ANNOTATION") return null;
  return it.nodeId ?? null;
}
