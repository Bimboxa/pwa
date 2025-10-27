import { useState } from "react";

import { Box, Typography } from "@mui/material";
import BoxCenter from "Features/layout/components/BoxCenter";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogCreateListing from "./DialogCreateListing";

export default function SectionHelperCreateFirstListing() {
  // strings

  const createS = "Créer une liste d'objets";

  const descriptionS =
    "Les objets que vous dessinez sur les fonds de plans sont regroupés dans des listes.";

  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleClick() {
    setOpen(true);
  }
  return (
    <>
      <BoxCenter sx={{ p: 1, display: "flex", flexDirection: "column" }}>
        <Box sx={{ mb: 4, px: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {descriptionS}
          </Typography>
        </Box>

        <ButtonGeneric
          label={createS}
          onClick={handleClick}
          variant="contained"
          color="secondary"
        />
      </BoxCenter>

      {open && (
        <DialogCreateListing
          open={open}
          onClose={() => setOpen(false)}
          locatedListingOnly={true}
        />
      )}
    </>
  );
}
