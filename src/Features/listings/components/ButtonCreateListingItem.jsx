import {useState} from "react";

import useListingEntityModel from "../hooks/useListingEntityModel";

import {Button, Paper} from "@mui/material";

import DialogFs from "Features/layout/components/DialogFs";
//import FormVariantMobile from "Features/form/components/FormVariantMobile";
import FormLocatedEntity from "Features/locatedEntities/components/FormLocatedEntity";

export default function ButtonCreateListingItem({listing}) {
  // data

  const entityModel = useListingEntityModel(listing);
  console.log("entityModel", listing, entityModel);

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const newButtonLabel = entityModel?.strings?.newButtonLabel ?? "-?-";

  // handlers - dialog

  function handleClick() {
    setOpen(true);
  }
  function handleClose() {
    setOpen(false);
  }

  // handlers - form

  return (
    <>
      <Paper sx={{width: 1, bgcolor: listing?.color, color: "common.white"}}>
        <Button fullWidth color="inherit" onClick={handleClick} size="large">
          {newButtonLabel}
        </Button>
      </Paper>
      <DialogFs open={open} onClose={handleClose}>
        {entityModel?.type === "locatedEntityModel" && <FormLocatedEntity />}
      </DialogFs>
    </>
  );
}
