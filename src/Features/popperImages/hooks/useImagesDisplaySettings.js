import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectImagesDisplayMode,
  selectImagesLinkLine,
  selectImagesLinkNumber,
  setImagesDisplayMode,
  setImagesLinkLine,
  setImagesLinkNumber,
} from "../popperImagesSlice";

// Display preferences of IMAGE annotations (the reducers also persist them).
export default function useImagesDisplaySettings() {
  const dispatch = useDispatch();
  const displayMode = useSelector(selectImagesDisplayMode);
  const linkLine = useSelector(selectImagesLinkLine);
  const linkNumber = useSelector(selectImagesLinkNumber);

  const setDisplayMode = useCallback(
    (mode) => dispatch(setImagesDisplayMode(mode)),
    [dispatch]
  );
  const setLinkLine = useCallback(
    (enabled) => dispatch(setImagesLinkLine(enabled)),
    [dispatch]
  );
  const setLinkNumber = useCallback(
    (enabled) => dispatch(setImagesLinkNumber(enabled)),
    [dispatch]
  );

  return {
    displayMode,
    linkLine,
    linkNumber,
    setDisplayMode,
    setLinkLine,
    setLinkNumber,
  };
}
