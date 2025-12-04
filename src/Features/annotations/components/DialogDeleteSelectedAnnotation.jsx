import { useSelector, useDispatch } from "react-redux";

import { setOpenDialogDeleteSelectedAnnotation } from "../annotationsSlice";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import db from "App/db/db";

export default function DialogDeleteSelectedAnnotation() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.annotations.openDialogDeleteSelectedAnnotation);
  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);

  // handlers

  function handleClose() {
    dispatch(setOpenDialogDeleteSelectedAnnotation(false));
  }

  async function handleDelete() {
    await db.annotations.delete(selectedNode?.nodeId);
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
