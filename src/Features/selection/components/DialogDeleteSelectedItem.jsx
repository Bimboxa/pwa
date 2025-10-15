import { useSelector, useDispatch } from "react-redux";

import { setOpenDialogDeleteSelectedItem } from "../selectionSlice";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import useDeleteEntity from "Features/entities/hooks/useDeleteEntity";

export default function DialogDeleteSelectedItem() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.selection.openDialogDeleteSelectedItem);
  const selectedItem = useSelector((s) => s.selection.selectedItem);

  // data - func

  const deleteEntity = useDeleteEntity();

  // handlers

  function handleClose() {
    dispatch(setOpenDialogDeleteSelectedItem(false));
  }

  async function handleDelete() {
    console.log("selectedItem", selectedItem);
    if (selectedItem?.type === "ENTITY") {
      await deleteEntity(selectedItem);
    }
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
