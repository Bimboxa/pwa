import { useSelector, useDispatch } from "react-redux";

import { setOpenDialogDeleteSelectedAnnotation } from "../annotationsSlice";
import { selectSelectedItems, clearSelection } from "Features/selection/selectionSlice";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import useDeleteAnnotations from "../hooks/useDeleteAnnotations";
import { setAnnotationToolbarPosition } from "Features/mapEditor/mapEditorSlice";

export default function DialogDeleteSelectedAnnotation() {
  const dispatch = useDispatch();
  const deleteAnnotations = useDeleteAnnotations();

  // data

  const open = useSelector((s) => s.annotations.openDialogDeleteSelectedAnnotation);
  const selectedItems = useSelector(selectSelectedItems);

  // handlers

  function handleClose() {
    dispatch(setOpenDialogDeleteSelectedAnnotation(false));
    dispatch(setAnnotationToolbarPosition(null));
  }

  async function handleDelete() {
    const annotationIds = selectedItems
      .filter((item) => item.nodeId)
      .map((item) => item.nodeId);
    if (annotationIds.length === 0) return;

    await deleteAnnotations(annotationIds);
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
