import { useSelector } from "react-redux";

import { Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCreateMarkerInListPanel from "Features/markers/components/SectionCreateMarkerInListPanel";

export default function SectionCreateLocatedEntityInListPanel() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  const showMarker = Boolean(enabledDrawingMode);

  // render

  return (
    <BoxFlexVStretch>
      <Typography>{enabledDrawingMode}</Typography>
      {showMarker && <SectionCreateMarkerInListPanel />}
    </BoxFlexVStretch>
  );
}
