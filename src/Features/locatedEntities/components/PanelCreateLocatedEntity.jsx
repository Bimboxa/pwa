import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";

import { Typography, Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCreateMarker from "Features/markers/components/SectionCreateMarker";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import SectionAnnotationTemplatesInPanelCreateLocatedEntity from "./SectionAnnotationTemplatesInPanelCreateLocatedEntity";

export default function PanelCreateLocatedEntity() {
  const dispatch = useDispatch();
  // strings

  const title = "Créer un objet";

  const selectToolS = "Sélectionnez un modèle";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  const showMarker = Boolean(enabledDrawingMode);

  // handlers

  function handleClose() {
    dispatch(setEnabledDrawingMode(null));
    dispatch(setOpenedPanel("LISTING"));
  }

  // render

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={title} onClose={handleClose} />
      {/* <Typography>{enabledDrawingMode}</Typography> */}
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <Typography sx={{ p: 2 }} variant="body2" color="text.secondary">
          {selectToolS}
        </Typography>
        <SectionAnnotationTemplatesInPanelCreateLocatedEntity />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
