import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { Typography, Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCreateMarker from "Features/markers/components/SectionCreateMarker";
import IconButtonClose from "Features/layout/components/IconButtonClose";

export default function PanelCreateLocatedEntity() {
  const dispatch = useDispatch();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  const showMarker = Boolean(enabledDrawingMode);

  // handlers

  function handleClose() {
    dispatch(setEnabledDrawingMode(null));
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", justifyContent: "end" }}>
        <IconButtonClose onClose={handleClose} />
      </Box>
      {/* <Typography>{enabledDrawingMode}</Typography> */}
      {showMarker && <SectionCreateMarker />}
    </BoxFlexVStretch>
  );
}
