import { useState } from "react";

import {
  Button,
  Menu,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
} from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";

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
      <Button endIcon={<Down />} onClick={handleClick} sx={{ ...sx }}>
        <Typography variant="body2" noWrap>
          {buttonLabel}
        </Typography>
      </Button>
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
                {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
                <ListItemText>{action.label}</ListItemText>
              </ListItemButton>
            );
          })}
      </Menu>
    </>
  );
}
