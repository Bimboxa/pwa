import { useState } from "react";

import { IconButton, Menu, MenuItem } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

import DialogDuplicateScope from "./DialogDuplicateScope";

export default function IconButtonMoreActionsScope({ scope }) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [openDuplicate, setOpenDuplicate] = useState(false);

  // handlers

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDuplicate = () => {
    setAnchorEl(null);
    setOpenDuplicate(true);
  };

  // render

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreActionsIcon />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem onClick={handleDuplicate}>Dupliquer</MenuItem>
      </Menu>

      <DialogDuplicateScope
        open={openDuplicate}
        onClose={() => setOpenDuplicate(false)}
        scope={scope}
      />
    </>
  );
}
