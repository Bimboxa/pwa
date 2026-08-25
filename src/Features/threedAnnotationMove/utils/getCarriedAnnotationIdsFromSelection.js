import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";

import { isPointBasedAnnotationType } from "./annotationTransformTypes";

// The set of annotations a move/rotate grab carries — implicit-selection
// rule:
// - grabbed annotation ∈ current selection → the whole selection is carried
//   (minus the members that can't follow: unsupported type, other base map,
//   foreign footprint — each exclusion is toasted);
// - grabbed annotation ∉ selection → it becomes the sole selected and sole
//   carried annotation (same selection dispatches as the 3D click).
// The grabbed annotation itself is already validated by the caller
// (point-based type, resolved base map).
export default function getCarriedAnnotationIdsFromSelection({
  grabbed,
  selectedItems,
  allAnnotations,
  dispatch,
}) {
  const selectionIds = (selectedItems ?? [])
    .filter((i) => i.type === "NODE" && i.nodeType === "ANNOTATION")
    .map((i) => i.nodeId ?? i.id);

  if (!selectionIds.includes(grabbed.annotationId)) {
    const item = {
      id: grabbed.annotationId,
      nodeId: grabbed.annotationId,
      type: "NODE",
      nodeType: "ANNOTATION",
      annotationType: grabbed.annotationType,
      listingId: grabbed.listingId,
      annotationTemplateId: grabbed.annotationTemplateId,
    };
    dispatch(
      setSelectedNode({
        id: grabbed.annotationId,
        nodeId: grabbed.annotationId,
        nodeType: "ANNOTATION",
        annotationType: grabbed.annotationType,
        listingId: grabbed.listingId,
      })
    );
    dispatch(setSelectedItem(item));
    return [grabbed.annotationId];
  }

  const carried = [];
  let excludedType = 0;
  let excludedBaseMap = 0;
  for (const id of selectionIds) {
    if (id === grabbed.annotationId) {
      carried.push(id);
      continue;
    }
    if (isForeignFootprintId(id)) {
      excludedType += 1;
      continue;
    }
    const ann = allAnnotations?.find((a) => a.id === id);
    if (!ann || !isPointBasedAnnotationType(ann.type)) {
      excludedType += 1;
      continue;
    }
    if (ann.baseMapId !== grabbed.baseMapId) {
      excludedBaseMap += 1;
      continue;
    }
    carried.push(id);
  }

  if (excludedType > 0) {
    dispatch(
      setToaster({
        message: `${excludedType} annotation(s) exclue(s) : type non pris en charge`,
        severity: "warning",
      })
    );
  }
  if (excludedBaseMap > 0) {
    dispatch(
      setToaster({
        message: `${excludedBaseMap} annotation(s) exclue(s) : autre fond de plan`,
        severity: "warning",
      })
    );
  }

  return carried;
}
