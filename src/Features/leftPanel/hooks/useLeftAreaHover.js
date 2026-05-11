import { useDispatch } from "react-redux";

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

  function onMouseEnter() {
    clearPendingClose();
    dispatch(setLeftDrawerHovered(true));
  }

  function onMouseLeave() {
    clearPendingClose();
    sharedCloseTimeout = setTimeout(() => {
      dispatch(setLeftDrawerHovered(false));
      sharedCloseTimeout = null;
    }, CLOSE_DELAY_MS);
  }

  return { onMouseEnter, onMouseLeave };
}
