import { useState } from "react";

import { IconButton } from "@mui/material";
import { Add } from "@mui/icons-material";

import { grey } from "@mui/material/colors";

import DialogCreateListing from "./DialogCreateListing";

export default function ButtonDialogCreateListingInVerticalSelector() {
  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <IconButton
        sx={{
          borderRadius: "8px",
          width: 32,
          height: 32,
          color: grey["500"],
          border: `1px solid ${grey["500"]}`,
        }}
        onClick={() => setOpen(true)}
      >
        <Add />
      </IconButton>

      {open && (
        <DialogCreateListing
          open={open}
          onClose={handleClose}
          fromPresetListings={true}
        />
      )}
    </>
  );
}
