import { useCallback, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setHollowOutDialogAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import DialogHollowOutAnnotation from "./DialogHollowOutAnnotation";
import DialogHollowOutAnnotation3d from "./DialogHollowOutAnnotation3d";

// Redux-driven host of the "Evider" dialog: the overlay button above the
// selected POLYGON and the "E" shortcut (InteractionLayer) only set
// mapEditor.hollowOutDialogAnnotationId. The dialog — and its annotations
// hooks — is mounted only while a carve is requested. Mount it once per
// ACTIVE editor (MainMapEditorV3 is instantiated for MAP and BASE_MAPS).
//
// `threedAnnotations` (the annotations loaded in the 3D editor) switches to the
// 3D variant: the annotations intersecting the selected one in 3D are offered
// as subtractions (DialogHollowOutAnnotation3d).
export default function DialogHollowOutAnnotationOutlet({ threedAnnotations }) {
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

  if (threedAnnotations) {
    return (
      <DialogHollowOutAnnotation3d
        key={annotationId}
        annotationId={annotationId}
        annotations={threedAnnotations}
        onClose={handleClose}
      />
    );
  }

  return (
    <DialogHollowOutAnnotation
      key={annotationId}
      annotationId={annotationId}
      onClose={handleClose}
    />
  );
}
