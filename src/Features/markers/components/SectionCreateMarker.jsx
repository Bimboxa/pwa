import { useSelector, useDispatch } from "react-redux";

import useMarkerTemplateByIndex from "../hooks/useMarkerTemplate";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { setTempMarkerProps } from "../markersSlice";

import { Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SelectorMarkerIcon from "./SelectorMarkerIcon";
import FormMarker from "./FormMarker";

export default function SectionCreateMarker() {
  const dispatch = useDispatch();

  // string

  const createS = "Nouveau marqueur";

  // data

  const tempMarkerProps = useSelector((s) => s.markers.tempMarkerProps);
  const markerTemplateByIndex = useMarkerTemplateByIndex();
  const appConfig = useAppConfig();

  // helpers - spriteImage

  const spriteImages = appConfig?.features?.markers?.spriteImages;
  const spriteImage = spriteImages?.[0];

  // helpers

  const iconIndex = tempMarkerProps.iconIndex;
  const iconColor = markerTemplateByIndex[iconIndex].iconColor;

  const tempMarker = { ...tempMarkerProps };

  // handlers

  const handleChangeIconIndex = (iconIndex) => {
    dispatch(
      setTempMarkerProps({
        ...tempMarkerProps,
        iconIndex,
        iconColor: markerTemplateByIndex[iconIndex].iconColor,
      })
    );
  };

  function handleTempMarkerChange(tempMarker) {
    dispatch(setTempMarkerProps(tempMarker));
  }

  return (
    <BoxFlexVStretch>
      <Typography sx={{ p: 1 }}>{createS}</Typography>
      <FormMarker
        marker={tempMarker}
        onChange={handleTempMarkerChange}
        spriteImage={spriteImage}
      />
      {/* <SelectorMarkerIcon
        iconIndex={iconIndex}
        iconColor={iconColor}
        onChange={handleChangeIconIndex}
      /> */}
    </BoxFlexVStretch>
  );
}
