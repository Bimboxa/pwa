import { useState } from "react";

import {
  Box,
  Button,
  Menu,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
} from "@mui/material";
import {
  ArrowDropDown as Down,
  Construction as Tool,
} from "@mui/icons-material";

export default function ButtonMenu({ buttonLabel, sx, actions }) {
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
      <Box sx={{ display: "flex", alignItems: "center", pl: 0.5 }}>
        <Button
          endIcon={<Down />}
          onClick={handleClick}
          sx={{ ...sx, ml: 0.5 }}
        >
          <Typography variant="body1" noWrap>
            {buttonLabel}
          </Typography>
        </Button>
      </Box>
      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        {actions
          ?.filter((action) => !action.hide)
          .map((action) => {
            return (
              <ListItemButton
                dense
                key={action.label}
                onClick={() => handleActionClick(action)}
              >
                {false && action.icon && (
                  <ListItemIcon>{action.icon}</ListItemIcon>
                )}
                <ListItemText>{action.label}</ListItemText>
              </ListItemButton>
            );
          })}
      </Menu>
    </>
  );
}
