import {useState, useRef} from "react";

import {
  IconButton,
  Popper,
  Box,
  ClickAwayListener,
  Dialog,
} from "@mui/material";

import DialogFs from "./DialogFs";

export default function IconButtonDialogFs({children, icon, onClose, title}) {
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
      <IconButton ref={anchorRef} onClick={handleClick}>
        {icon}
      </IconButton>
      {open && (
        <DialogFs open={open} onClose={handleClose} title={title}>
          {children}
        </DialogFs>
      )}
    </>
  );
}
