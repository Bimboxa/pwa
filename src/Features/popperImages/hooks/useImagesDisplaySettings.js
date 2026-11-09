import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectImagesDisplayMode,
  selectImagesLinkStyle,
  setImagesDisplayMode,
  setImagesLinkStyle,
} from "../popperImagesSlice";

// Display preferences of IMAGE annotations (the reducers also persist them).
export default function useImagesDisplaySettings() {
  const dispatch = useDispatch();
  const displayMode = useSelector(selectImagesDisplayMode);
  const linkStyle = useSelector(selectImagesLinkStyle);

  const setDisplayMode = useCallback(
    (mode) => dispatch(setImagesDisplayMode(mode)),
    [dispatch]
  );
  const setLinkStyle = useCallback(
    (style) => dispatch(setImagesLinkStyle(style)),
    [dispatch]
  );

  return { displayMode, linkStyle, setDisplayMode, setLinkStyle };
}
