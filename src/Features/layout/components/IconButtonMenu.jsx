import {useState} from "react";

import {IconButton, Menu, ListItemButton} from "@mui/material";

export default function IconButtonMenu({icon, actions}) {
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
      <IconButton onClick={handleClick}>{icon}</IconButton>
      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        {actions?.map((action) => {
          return (
            <ListItemButton
              key={action.label}
              onClick={() => handleActionClick(action)}
            >
              {action.label}
            </ListItemButton>
          );
        })}
      </Menu>
    </>
  );
}
