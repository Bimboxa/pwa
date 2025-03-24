import useIsMobile from "Features/layout/hooks/useIsMobile";

import DialogFs from "./DialogFs";

import {Menu} from "@mui/material";

export default function DialogFsOrMenu({open, onClose, anchorEl, children}) {
  // data

  const isMobile = useIsMobile();

  // handlers

  function handleClose() {
    onClose();
  }

  return (
    <>
      {isMobile ? (
        <DialogFs open={open} onClose={handleClose}>
          {children}
        </DialogFs>
      ) : (
        <Menu
          open={open}
          onClose={handleClose}
          anchorEl={open ? anchorEl : null}
        >
          {children}
        </Menu>
      )}
    </>
  );
}
