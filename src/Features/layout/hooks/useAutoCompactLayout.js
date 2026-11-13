import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setCompactLayout } from "../layoutSlice";

import { useMediaQuery } from "@mui/material";

import theme from "Styles/theme";

// Keeps layout.compactLayout in sync with the window width: below the "md"
// breakpoint the desktop layout only shows the editor (typically a narrow
// second window following the main one). Stored in Redux so selectors
// (commands toolbar visibility, hotkeys) can read it.
export default function useAutoCompactLayout() {
  const dispatch = useDispatch();

  const isCompact = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    dispatch(setCompactLayout(isCompact));
  }, [dispatch, isCompact]);

  return isCompact;
}
