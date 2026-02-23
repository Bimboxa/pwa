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
  const currentUserId = useSelector((s) => s.auth.userProfile?.userIdMaster);

  // handlers

  function handleClose() {
    dispatch(setOpenDialogDeleteSelectedAnnotation(false));
    dispatch(setAnnotationToolbarPosition(null));
  }

  async function handleDelete() {
    const annotationId = selectedItem?.nodeId;
    if (!annotationId) return;

    // PERMISSION GUARD : vérifier propriété avant suppression
    const annotation = await db.annotations.get(annotationId);
    if (
      annotation?.createdByUserIdMaster !== currentUserId &&
      annotation?.createdByUserIdMaster !== "anonymous"
    ) {
      handleClose();
      return;
    }

    await db.annotations.delete(annotationId);
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
