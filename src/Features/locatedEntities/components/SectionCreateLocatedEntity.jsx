import { useSelector } from "react-redux";

import { Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCreateMarker from "Features/markers/components/SectionCreateMarker";

export default function SectionCreateLocatedEntity() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  const showMarker = Boolean(enabledDrawingMode);

  // render

  return (
    <BoxFlexVStretch>
      {/* <Typography>{enabledDrawingMode}</Typography> */}
      {showMarker && <SectionCreateMarker />}
    </BoxFlexVStretch>
  );
}
