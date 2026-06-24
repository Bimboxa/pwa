import useDeleteListing from "../hooks/useDeleteListing";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import { OwnershipError } from "App/db/ownership";
import useCanEditRecord from "App/hooks/useCanEditRecord";

export default function DialogDeleteListing({ open, listing, onClose }) {
  // data

  const deleteListing = useDeleteListing();
  const { guardEditRecord } = useCanEditRecord();

  // handler

  async function handleConfirm() {
    if (!guardEditRecord(listing)) {
      onClose?.();
      return;
    }
    try {
      await deleteListing(listing?.id);
    } catch (error) {
      if (!(error instanceof OwnershipError)) throw error;
    }
  }

  return (
    <DialogDeleteRessource
      open={open}
      onClose={onClose}
      onConfirmAsync={handleConfirm}
    />
  );
}
