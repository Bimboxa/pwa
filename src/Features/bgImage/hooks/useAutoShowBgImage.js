import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setShowBgImageInMapEditor } from "../bgImageSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useAutoShowBgImage() {
  const dispatch = useDispatch();

  // data

  const { value: listing } = useSelectedListing();
  const mode = useSelector((s) => s.rightPanel.selectedMenuItemKey);

  // helpers

  const isBlueprintListing = listing?.entityModel?.type === "BLUEPRINT";

  const show = isBlueprintListing || mode === "PDF_REPORT";
  // effect

  useEffect(() => {
    dispatch(setShowBgImageInMapEditor(show));
  }, [show]);
}
