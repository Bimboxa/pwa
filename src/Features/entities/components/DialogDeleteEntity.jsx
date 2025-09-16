import useDeleteEntity from "../hooks/useDeleteEntity";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function DialogDeleteEntity({ open, entity, onClose }) {
  // data

  const deleteEntity = useDeleteEntity();

  // handler

  async function handleConfirm() {
    await deleteEntity(entity);
    onClose();
  }

  return (
    <DialogDeleteRessource
      open={open}
      onClose={onClose}
      onConfirmAsync={handleConfirm}
    />
  );
}
