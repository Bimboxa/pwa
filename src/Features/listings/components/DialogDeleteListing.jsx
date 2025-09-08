import useDeleteListing from "../hooks/useDeleteListing";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function DialogDeleteListing({ open, listing, onClose }) {
  // data

  const deleteListing = useDeleteListing();

  // handler

  async function handleConfirm() {
    await deleteListing(listing?.id);
  }

  return (
    <DialogDeleteRessource
      open={open}
      onClose={onClose}
      onConfirmAsync={handleConfirm}
    />
  );
}
