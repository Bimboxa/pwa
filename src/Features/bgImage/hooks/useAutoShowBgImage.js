import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setShowBgImageInMapEditor } from "../bgImageSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useAutoShowBgImage() {
  const dispatch = useDispatch();

  // data

  const { value: listing } = useSelectedListing();

  // helpers

  const isBlueprintListing = listing?.entityModel?.type === "BLUEPRINT";

  // effect

  useEffect(() => {
    dispatch(setShowBgImageInMapEditor(isBlueprintListing));
  }, [isBlueprintListing]);
}
