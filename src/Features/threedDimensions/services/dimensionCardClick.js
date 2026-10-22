import {
  setAnnotationToolbarPosition,
  setAnnotationsToolbarPosition,
  setSelectedNode,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  setShowAnnotationsProperties,
  setSubSelection,
  toggleItemSelection,
} from "Features/selection/selectionSlice";
import { clearSubSelection } from "Features/threedEditor/threedEditorSlice";
import { filterIntersectionsByClipping } from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";

import getSingleSelectedAnnotationId from "../utils/getSingleSelectedAnnotationId";
import {
  DIMENSION_LABEL_PART_TYPE,
  getDimensionLabelPartId,
} from "../utils/dimensionLabelPart";
import { getDimensionObjects } from "./dimensionObjectsStore";

// Click on a cote / ruler value card (the sprites published to
// dimensionObjectsStore — invisible to the `.isMesh` annotation picks, hence
// this dedicated pre-pass, shared by MainThreedEditor's handleClick and the
// Maillage module's meshing pointer handlers):
//   - an unselected annotation: the click selects it, with the SAME payload
//     as the generic annotation branch (normal popper / properties /
//     Delete-key flows), Shift toggles it;
//   - the already-selected annotation (NODE item alone): the click
//     sub-selects THAT card (DIMENSION_LABEL part) — its drag is then the
//     card's (useCoteLabelDragHandlers / useRulerLabelDragHandlers); Shift
//     keeps the selection toggle.
// `raycaster` must already be set from the pointer. Returns the sprite hit
// (the caller stops there), or null when no card is under the pointer.
export function pickDimensionCard(raycaster, clippingPlane) {
  const sprites = getDimensionObjects();
  if (!sprites.length) return null;
  const hits = filterIntersectionsByClipping(
    raycaster.intersectObjects(sprites, false),
    clippingPlane
  );
  const sprite = hits[0]?.object;
  return sprite?.userData?.annotationId ? sprite : null;
}

export function handleDimensionCardClick({
  dispatch,
  selectedItems,
  sprite,
  event,
}) {
  const { annotationId, annotationType, listingId, annotationTemplateId } =
    sprite.userData;
  const segmentKey = sprite.userData.segmentKey;
  const position = { x: event.clientX, y: event.clientY };
  const selectedId = getSingleSelectedAnnotationId(selectedItems);
  // One decision line per card click so a "nothing happened" report
  // pinpoints the exit taken (temporary diagnostics).
  const decision =
    segmentKey && !event.shiftKey && selectedId === annotationId
      ? "SUB_SELECT_CARD"
      : event.shiftKey
        ? "TOGGLE"
        : "SELECT";
  console.log("[threedDimensions] card click", {
    annotationType,
    annotationId,
    segmentKey: segmentKey ?? null,
    selectedId,
    decision,
  });

  if (decision === "SUB_SELECT_CARD") {
    dispatch(
      setSubSelection({
        partId: getDimensionLabelPartId(annotationId, segmentKey),
        partType: DIMENSION_LABEL_PART_TYPE,
        pointId: null,
      })
    );
    dispatch(setAnnotationToolbarPosition(position));
    dispatch(setAnnotationsToolbarPosition(position));
    return;
  }

  const item = {
    id: annotationId,
    nodeId: annotationId,
    type: "NODE",
    nodeType: "ANNOTATION",
    annotationType,
    listingId,
    annotationTemplateId,
  };
  if (decision === "TOGGLE") {
    dispatch(toggleItemSelection(item));
  } else {
    dispatch(
      setSelectedNode({
        id: annotationId,
        nodeId: annotationId,
        nodeType: "ANNOTATION",
        annotationType,
        listingId,
      })
    );
    dispatch(setSelectedItem(item));
    dispatch(setShowAnnotationsProperties(true));
  }
  dispatch(clearSubSelection());
  dispatch(setAnnotationToolbarPosition(position));
  dispatch(setAnnotationsToolbarPosition(position));
}
