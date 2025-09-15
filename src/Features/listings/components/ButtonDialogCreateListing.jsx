import { useState } from "react";

import { IconButton } from "@mui/material";
import { Add } from "@mui/icons-material";
import DialogCreateListing from "./DialogCreateListing";

export default function ButtonDialogCreateListing() {
  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <IconButton onClick={() => setOpen(true)}>
        <Add />
      </IconButton>

      {open && <DialogCreateListing open={open} onClose={handleClose} />}
    </>
  );
}
