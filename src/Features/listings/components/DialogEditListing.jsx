import { useState, useEffect } from "react";

import useSelectedListing from "../hooks/useSelectedListing";
import useUpdateListing from "../hooks/useUpdateListing";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormListing from "./FormListing";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import DialogGeneric from "Features/layout/components/DialogGeneric";

export default function DialogEditListing({ open, onClose, listing }) {
  // strings

  const title = "Configuration du module";
  const saveS = "Enregistrer";

  // data
  const { value: selectedListing } = useSelectedListing();

  // data - func
  const updateListing = useUpdateListing();

  // helpers

  listing = listing || selectedListing;

  // state

  const [tempListing, setTempListing] = useState(listing);
  useEffect(() => {
    setTempListing(listing);
  }, [listing?.id]);

  console.log("tempListing", tempListing);

  // handlers

  function handleChange(listing) {
    setTempListing(listing);
  }

  async function handleSave() {
    const _listing = { ...tempListing };
    _listing.entityModelKey = _listing?.entityModel?.key;
    _listing.table = _listing?.entityModel?.defaultTable;
    delete _listing.entityModel;

    await updateListing(_listing, { updateSyncFile: true });
    onClose();
  }
  // render

  return (
    <DialogGeneric
      title={title}
      open={open}
      onClose={onClose}
      width={350}
      vh={70}
    >
      <BoxFlexVStretch>
        <FormListing listing={tempListing} onChange={handleChange} />
      </BoxFlexVStretch>
      <ButtonInPanel label={saveS} onClick={handleSave} />
    </DialogGeneric>
  );
}
