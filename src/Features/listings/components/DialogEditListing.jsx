import { useState, useEffect } from "react";

import { useSelector } from "react-redux";

import useListings from "../hooks/useListings";
import useSelectedListing from "../hooks/useSelectedListing";
import useUpdateListing from "../hooks/useUpdateListing";
import useListingEntityModel from "../hooks/useListingEntityModel";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormListing from "./FormListing";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";

export default function DialogEditListing({ open, onClose, listing }) {
  // strings

  const title = "Editer la liste";
  const saveS = "Enregistrer";

  // data
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: selectedListing } = useSelectedListing({
    withEntityModel: true,
  });
  const listings = useListings({ filterByProjectId: projectId });

  // data - func
  const updateListing = useUpdateListing();

  // helpers

  listing = listing || selectedListing;

  const entityModel = useListingEntityModel(listing);

  // state

  const [tempListing, setTempListing] = useState(listing);
  useEffect(() => {
    if (entityModel) {
      setTempListing({ ...listing, entityModel });
    }
  }, [listing?.id, entityModel?.key]);

  // handlers

  function handleChange(listing) {
    setTempListing(listing);
  }

  async function handleSave() {
    const _listing = { ...tempListing };
    _listing.entityModelKey = _listing?.entityModel?.key;
    _listing.table = _listing?.entityModel?.defaultTable;
    delete _listing.entityModel;

    console.log("[DialogEditListing] _listing", _listing);
    await updateListing(_listing, { updateSyncFile: true });
    onClose();
  }
  // render

  return (
    <DialogGeneric open={open} onClose={onClose} width={350} vh={70}>
      <HeaderTitleClose title={title} />
      <BoxFlexVStretch>
        <FormListing
          listing={tempListing}
          relatedListings={listings}
          onChange={handleChange}
        />
      </BoxFlexVStretch>
      <ButtonInPanel label={saveS} onClick={handleSave} />
    </DialogGeneric>
  );
}
