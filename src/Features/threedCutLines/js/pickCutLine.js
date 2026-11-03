import {
  setAnnotationToolbarPosition,
  setAnnotationsToolbarPosition,
  setSelectedNode,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  setShowAnnotationsProperties,
  toggleItemSelection,
} from "Features/selection/selectionSlice";
import { clearSubSelection } from "Features/threedEditor/threedEditorSlice";
import { filterIntersectionsByClipping } from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";

import { getCutLineLines } from "../services/cutLineObjectsStore";

// Click pre-pass on the cut lines (the Line2 segments published to
// cutLineObjectsStore carry the fat-line raycast; the `.isMesh` annotation
// picks of MainThreedEditor and of the Maillage module skip fat lines).
// `raycaster` must already be set from the pointer. Returns the hit
// { annotationId, line } or null.
export function pickCutLine(raycaster, clippingPlane) {
  const lines = getCutLineLines();
  if (!lines.length) return null;
  const hits = filterIntersectionsByClipping(
    raycaster.intersectObjects(lines, false),
    clippingPlane
  );
  const line = hits[0]?.object;
  const annotationId = line?.userData?.annotationId;
  return annotationId ? { annotationId, line } : null;
}

// Selection of a clicked cut line, with the same payload as the generic
// annotation branch (normal popper / properties / Delete-key flows); Shift
// toggles it in the selection. A click on the already-selected line is a
// no-op here (its vertices are the sub-selectable parts —
// useCutLineVertexHandlers).
export function handleCutLineClick({ dispatch, selectedItems, hit, event }) {
  const { annotationId } = hit;
  const position = { x: event.clientX, y: event.clientY };
  const item = {
    id: annotationId,
    nodeId: annotationId,
    type: "NODE",
    nodeType: "ANNOTATION",
    annotationType: "CUT_LINE",
    listingId: null,
    annotationTemplateId: null,
  };
  if (event.shiftKey) {
    dispatch(toggleItemSelection(item));
  } else {
    const alreadySolo =
      selectedItems?.length === 1 &&
      selectedItems[0]?.nodeType === "ANNOTATION" &&
      selectedItems[0]?.nodeId === annotationId;
    if (alreadySolo) return;
    dispatch(
      setSelectedNode({
        id: annotationId,
        nodeId: annotationId,
        nodeType: "ANNOTATION",
        annotationType: "CUT_LINE",
        listingId: null,
      })
    );
    dispatch(setSelectedItem(item));
    dispatch(setShowAnnotationsProperties(true));
  }
  dispatch(clearSubSelection());
  dispatch(setAnnotationToolbarPosition(position));
  dispatch(setAnnotationsToolbarPosition(position));
}
