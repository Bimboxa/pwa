import useIsMobile from "../hooks/useIsMobile";

import {
  Box,
  Menu,
  ListItemButton,
  Typography,
  ClickAwayListener,
} from "@mui/material";

import PageGeneric from "./PageGeneric";
import {createPortal} from "react-dom";

export default function MenuGeneric({open, anchorEl, onClose, actions}) {
  // data

  const isMobile = useIsMobile();

  // handlers

  function handleActionClick(action) {
    action.handler();
    handleClose();
  }

  function handleClose() {
    console.log("close menu");
    if (onClose) {
      onClose();
    }
  }

  // render - helper

  const actionsArray = actions
    ?.filter((action) => !action.hide)
    .map((action) => {
      return (
        <ListItemButton
          key={action.label}
          onClick={() => handleActionClick(action)}
          divider
        >
          {action.label}
        </ListItemButton>
      );
    });

  // render - mobile

  if (isMobile && anchorEl)
    return createPortal(
      <PageGeneric>
        <PageGeneric sx={{bgcolor: "black", opacity: 0.8}} />
        <ClickAwayListener onClickAway={onClose}>
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              borderRadius: "8px 8px 0 0",
              p: 1,
              width: 1,
              bgcolor: "white",
            }}
          >
            {actionsArray}
          </Box>
        </ClickAwayListener>
      </PageGeneric>,
      document.body
    );

  if (!isMobile)
    return (
      <Menu open={open} anchorEl={anchorEl} onClose={onClose}>
        {actionsArray}
      </Menu>
    );
}
