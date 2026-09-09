// Selection helpers for annotation sub-labels (the "label::<annotationId>"
// chip / 3D card of an annotation).
//
// A label click selects an item of type "ANNOTATION_LABEL". The item keeps the
// map node fields (nodeId "label::<id>", nodeType "ANNOTATION", annotationType
// "LABEL") so the existing label:: plumbing (drag, live copy, hide rules,
// labelDelta commit) keeps working unchanged — only the selection type and
// the right-panel differ. `annotationId` / `parentAnnotationType` let
// triggerSelectionBack rebuild the parent annotation NODE item.

export const LABEL_NODE_ID_PREFIX = "label::";

export function isAnnotationLabelNodeId(id) {
  return typeof id === "string" && id.startsWith(LABEL_NODE_ID_PREFIX);
}

export function getAnnotationIdFromLabelNodeId(id) {
  return isAnnotationLabelNodeId(id) ? id.slice(LABEL_NODE_ID_PREFIX.length) : id;
}

export function buildAnnotationLabelSelectionItem({
  annotation,
  nodeId,
  nodeContext,
}) {
  const annotationId = annotation?.id ?? getAnnotationIdFromLabelNodeId(nodeId);
  const labelNodeId = nodeId ?? LABEL_NODE_ID_PREFIX + annotationId;
  return {
    id: labelNodeId,
    type: "ANNOTATION_LABEL",
    nodeId: labelNodeId,
    nodeType: "ANNOTATION",
    annotationType: "LABEL",
    annotationId,
    parentAnnotationType: annotation?.type ?? null,
    listingId: annotation?.listingId,
    annotationTemplateId: annotation?.annotationTemplateId,
    nodeContext: nodeContext ?? null,
    partId: null,
    partType: null,
  };
}

// Annotation ids carried by a selection: annotation NODE items give their
// nodeId, ANNOTATION_LABEL items give their parent annotation id.
export function getSelectedAnnotationIds(items) {
  return (items || [])
    .map((it) => {
      if (!it) return null;
      if (it.type === "ANNOTATION_LABEL") return it.annotationId ?? null;
      if (it.type === "NODE" && it.nodeType === "ANNOTATION") return it.nodeId;
      return null;
    })
    .filter(Boolean);
}
