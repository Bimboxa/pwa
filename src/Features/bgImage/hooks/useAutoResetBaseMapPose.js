import { useEffect } from "react";

import { useSelector } from "react-redux";

import useResetBaseMapPose from "Features/mapEditor/hooks/useResetBaseMapPose";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useAutoResetBaseMapPose() {
  const reset = useResetBaseMapPose();

  // data

  const mainBaseMap = useMainBaseMap();
  const bgImage = useBgImageInMapEditor();
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const { value: selectedListing } = useSelectedListing();

  // helper

  const isBlueprintListing = selectedListing?.entityModel?.type === "BLUEPRINT";

  // effect

  useEffect(() => {
    console.log(
      "RESET_",
      showBgImage,
      mainBaseMap?.id,
      bgImage?.url,
      isBlueprintListing
    );
    if (showBgImage && mainBaseMap?.id && bgImage?.url && !isBlueprintListing) {
      reset();
    }
  }, [showBgImage, mainBaseMap?.id, bgImage?.url, isBlueprintListing]);
}
