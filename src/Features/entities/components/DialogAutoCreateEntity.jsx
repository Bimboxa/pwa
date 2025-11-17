import { useSelector, useDispatch } from "react-redux";
import { setOpenDialogCreateEntity } from "../entitiesSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelCreateListingEntity from "./PanelCreateListingEntity";

export default function DialogAutoCreateEntity() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.entities.openDialogCreateEntity);
  const { value: listing } = useSelectedListing();

  // handlers

  function handleClose() {
    dispatch(setOpenDialogCreateEntity(false));
  }

  function handleEntityCreated(entity) {
    dispatch(setOpenDialogCreateEntity(false));
  }

  if (!open) return null;

  return (
    <DialogGeneric open={open} onClose={handleClose} width="300px">
      <PanelCreateListingEntity
        listing={listing}
        onClose={handleClose}
        onEntityCreated={handleEntityCreated}
      />
    </DialogGeneric>
  );
}
