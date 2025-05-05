import useIsMobile from "Features/layout/hooks/useIsMobile";

import DialogFs from "./DialogFs";

import {Menu} from "@mui/material";
import BoxFlexVStretch from "./BoxFlexVStretch";

export default function DialogFsOrMenu({
  open,
  onClose,
  anchorEl,
  children,
  title,
}) {
  // data

  const isMobile = useIsMobile();

  // handlers

  function handleClose() {
    onClose();
  }

  // render
  if (open && isMobile) {
    return (
      <DialogFs open={open} onClose={handleClose} title={title}>
        {children}
      </DialogFs>
    );
  } else if (open && !isMobile) {
    return (
      <Menu
        sx={{
          "& .MuiPaper-root": {
            bgcolor: "background.default",
            minWidth: 240,
          },
        }}
        open={open}
        onClose={handleClose}
        anchorEl={open ? anchorEl : null}
      >
        {children}
      </Menu>
    );
  } else {
    return <></>;
  }
}
