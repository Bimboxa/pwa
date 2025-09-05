import useDeleteScope from "../hooks/useDeleteScope";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function DialogDeleteScope({ open, onClose, scopeId }) {
  // data

  const deleteScope = useDeleteScope();
  // handlers

  async function handleDelete() {
    await deleteScope(scopeId);
    onClose();
  }

  return (
    <DialogDeleteRessource
      open={open}
      onClose={onClose}
      onConfirmAsync={handleDelete}
    />
  );
}
