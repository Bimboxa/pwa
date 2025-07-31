import { useSelector, useDispatch } from "react-redux";

import useMarkerTemplateByIndex from "../hooks/useMarkerTemplate";

import { setTempMarkerProps } from "../markersSlice";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SelectorMarkerIcon from "./SelectorMarkerIcon";

export default function SectionCreateMarkerInListPanel() {
  const dispatch = useDispatch();

  // data

  const tempMarkerProps = useSelector((s) => s.markers.tempMarkerProps);
  const markerTemplateByIndex = useMarkerTemplateByIndex();

  // helpers

  const iconIndex = tempMarkerProps.iconIndex;
  const iconColor = markerTemplateByIndex[iconIndex].iconColor;

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

  return (
    <BoxFlexVStretch>
      <SelectorMarkerIcon
        iconIndex={iconIndex}
        iconColor={iconColor}
        onChange={handleChangeIconIndex}
      />
    </BoxFlexVStretch>
  );
}
