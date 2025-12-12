import { useEffect, useState } from "react";

import { useSelector } from "react-redux";

import useResetBaseMapPose from "Features/mapEditor/hooks/useResetBaseMapPose";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useAutoResetBaseMapPose() {
  const reset = useResetBaseMapPose();

  // state

  const [resetOnce, setResetOnce] = useState({});

  // data

  const mainBaseMap = useMainBaseMap();
  const bgImage = useBgImageInMapEditor(); // {url, width, height, bbox}
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const { value: selectedListing } = useSelectedListing();
  const blueprintId = useSelector((s) => s.blueprints.blueprintIdInMapEditor);

  // helper

  const isBlueprintListing = selectedListing?.entityModel?.type === "BLUEPRINT";
  const once = resetOnce[mainBaseMap?.id];

  // handlers

  function handleResetOnce(mainBaseMapId) {
    setResetOnce((reset) => ({ ...reset, [mainBaseMapId]: true }));
  }
  // effect

  useEffect(() => {
    if (
      !once &&
      showBgImage &&
      mainBaseMap?.id &&
      bgImage?.url &&
      (!isBlueprintListing || !blueprintId)
    ) {
      reset();
      handleResetOnce(mainBaseMap?.id);
    }
  }, [
    showBgImage,
    mainBaseMap?.id,
    bgImage?.url,
    once,
    blueprintId,
    isBlueprintListing,
  ]);
}
