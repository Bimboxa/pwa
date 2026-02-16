import { useSelector, useDispatch } from "react-redux";

import { setOpenDialogDeleteSelectedAnnotation } from "../annotationsSlice";
import { selectSelectedItem, clearSelection } from "Features/selection/selectionSlice";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import db from "App/db/db";
import { setAnnotationToolbarPosition } from "Features/mapEditor/mapEditorSlice";

export default function DialogDeleteSelectedAnnotation() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.annotations.openDialogDeleteSelectedAnnotation);
  const selectedItem = useSelector(selectSelectedItem);

  // handlers

  function handleClose() {
    dispatch(setOpenDialogDeleteSelectedAnnotation(false));
    dispatch(setAnnotationToolbarPosition(null));
  }

  async function handleDelete() {
    const annotationId = selectedItem?.nodeId;
    if (annotationId) {
      await db.annotations.delete(annotationId);
    }
    dispatch(clearSelection());
    handleClose();
  }
  // render

  return (
    <DialogDeleteRessource
      open={open}
      onConfirmAsync={handleDelete}
      onClose={handleClose}
    />
  );
}
