import { useCallback, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setHollowOutDialogAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import DialogHollowOutAnnotation from "./DialogHollowOutAnnotation";

// Redux-driven host of the "Evider" dialog: the overlay button above the
// selected POLYGON and the "E" shortcut (InteractionLayer) only set
// mapEditor.hollowOutDialogAnnotationId. The dialog — and its annotations
// hooks — is mounted only while a carve is requested. Mount it once per
// ACTIVE editor (MainMapEditorV3 is instantiated for MAP and BASE_MAPS).
export default function DialogHollowOutAnnotationOutlet() {
  const dispatch = useDispatch();

  // data

  const annotationId = useSelector(
    (s) => s.mapEditor.hollowOutDialogAnnotationId
  );

  // handlers

  const handleClose = useCallback(() => {
    dispatch(setHollowOutDialogAnnotationId(null));
  }, [dispatch]);

  // The request targets THE selected annotation: drop it as soon as the
  // selection moves on (deselect, delete, other annotation), so a stale id
  // can never pop the dialog later.
  const selectedItems = useSelector(selectSelectedItems);
  const isStillSelected =
    selectedItems.length === 1 && selectedItems[0]?.nodeId === annotationId;
  useEffect(() => {
    if (annotationId && !isStillSelected) handleClose();
  }, [annotationId, isStillSelected, handleClose]);

  // render

  if (!annotationId) return null;

  return (
    <DialogHollowOutAnnotation
      key={annotationId}
      annotationId={annotationId}
      onClose={handleClose}
    />
  );
}
