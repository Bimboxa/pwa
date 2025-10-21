import { useState } from "react";

import { IconButton } from "@mui/material";
import { Save } from "@mui/icons-material";

import DialogUpdateVersion from "./DialogUpdateVersion";

export default function IconButtonSaveVersion() {
  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleClick() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <IconButton onClick={handleClick}>
        <Save />
      </IconButton>
      {open && <DialogUpdateVersion open={open} onClose={handleClose} />}
    </>
  );
}
