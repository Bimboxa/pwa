import {useState, useEffect} from "react";

import useSelectedListing from "../hooks/useSelectedListing";
import useUpdateListing from "../hooks/useUpdateListing";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormListing from "./FormListing";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import DialogGeneric from "Features/layout/components/DialogGeneric";

export default function DialogEditListing({open, onClose, listing}) {
  // strings

  const title = "Configuration du module";
  const saveS = "Enregistrer";

  // data
  const {value: selectedListing} = useSelectedListing();

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

  async function handleSave() {
    await updateListing(tempListing, {updateSyncFile: true});
    onClose();
  }
  // render

  return (
    <DialogGeneric title={title} open={open} onClose={onClose} vw={30} vh={50}>
      <BoxFlexVStretch>
        <FormListing listing={tempListing} onChange={setTempListing} />
      </BoxFlexVStretch>
      <ButtonInPanel label={saveS} onClick={handleSave} />
    </DialogGeneric>
  );
}
