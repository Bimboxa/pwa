import { useDispatch } from "react-redux";
import { useTheme, useMediaQuery } from "@mui/material";

import { setLeftDrawerHovered } from "../leftPanelSlice";

const CLOSE_DELAY_MS = 300;

// Module-scoped so VerticalMenuViewers, LeftDrawerPanel, and LeftEdgeHoverZone
// share the same pending close. Moving the mouse between any of them cancels
// the close scheduled by whichever element was just left.
let sharedCloseTimeout = null;

function clearPendingClose() {
  if (sharedCloseTimeout) {
    clearTimeout(sharedCloseTimeout);
    sharedCloseTimeout = null;
  }
}

export default function useLeftAreaHover() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isBelowMd = useMediaQuery(theme.breakpoints.down("md"));

  function onMouseEnter() {
    if (isBelowMd) return;
    clearPendingClose();
    dispatch(setLeftDrawerHovered(true));
  }

  function onMouseLeave() {
    if (isBelowMd) return;
    clearPendingClose();
    sharedCloseTimeout = setTimeout(() => {
      dispatch(setLeftDrawerHovered(false));
      sharedCloseTimeout = null;
    }, CLOSE_DELAY_MS);
  }

  return { onMouseEnter, onMouseLeave };
}
