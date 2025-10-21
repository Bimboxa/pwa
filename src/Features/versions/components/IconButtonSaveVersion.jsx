import { useState } from "react";

import { IconButton, Tooltip } from "@mui/material";
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
      <Tooltip title="Enregistrer les modifications">
        <IconButton onClick={handleClick} size="small">
          <Save fontSize="small" />
        </IconButton>
      </Tooltip>
      {open && <DialogUpdateVersion open={open} onClose={handleClose} />}
    </>
  );
}
