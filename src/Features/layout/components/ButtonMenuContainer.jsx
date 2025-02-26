import {useState} from "react";

import {Button, Menu} from "@mui/material";
import {ArrowDropDown as Down} from "@mui/icons-material";

export default function ButtonMenuContainer({buttonLabel, sx, children}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleActionClick(action) {
    action.handler();
    handleClose();
  }
  return (
    <>
      <Button onClick={handleClick} sx={sx} startIcon={<Down />}>
        {buttonLabel}
      </Button>
      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        {children}
      </Menu>
    </>
  );
}
