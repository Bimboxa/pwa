import { useSelector, useDispatch } from "react-redux";

import { setOpenDialogDeleteSelectedAnnotation } from "../annotationsSlice";
import { setSelectedNode, setSelectedNodes } from "Features/mapEditor/mapEditorSlice";


import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import db from "App/db/db";
import { setAnnotationToolbarPosition } from "Features/mapEditor/mapEditorSlice";

export default function DialogDeleteSelectedAnnotation() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.annotations.openDialogDeleteSelectedAnnotation);
  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);

  // handlers

  function handleClose() {
    dispatch(setOpenDialogDeleteSelectedAnnotation(false));
    dispatch(setAnnotationToolbarPosition(null));
  }

  async function handleDelete() {
    await db.annotations.delete(selectedNode?.nodeId);
    dispatch(setSelectedNode(null));
    dispatch(setSelectedNodes([]));
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
