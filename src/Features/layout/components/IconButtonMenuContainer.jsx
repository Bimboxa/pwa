import { useState } from "react";

import { IconButton, Menu, ListItemButton, Box } from "@mui/material";

export default function IconButtonMenuContainer({ icon, children, sx }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  return (
    <>
      <Box sx={{ borderRadius: 2, ...sx }}>
        <IconButton onClick={handleClick}>{icon}</IconButton>
      </Box>
      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        {children}
      </Menu>
    </>
  );
}
