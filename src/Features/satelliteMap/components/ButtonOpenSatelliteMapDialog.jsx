import { useState } from "react";

import { Public } from "@mui/icons-material";
import { Button } from "@mui/material";

import DialogCreateBaseMapFromSatellite from "./DialogCreateBaseMapFromSatellite";

export default function ButtonOpenSatelliteMapDialog({
  listing,
  onCreated,
  onClose,
}) {
  // strings

  const label = "Ajouter une image satellite";

  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleCreated(entity) {
    setOpen(false);
    onCreated?.(entity);
    onClose?.();
  }

  // render

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="outlined"
        color="inherit"
        size="small"
        startIcon={<Public />}
      >
        {label}
      </Button>

      <DialogCreateBaseMapFromSatellite
        open={open}
        onClose={handleClose}
        listing={listing}
        onCreated={handleCreated}
      />
    </>
  );
}
