import { useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import SectionAnnotationTemplatesInPanelCreateLocatedEntity from "./SectionAnnotationTemplatesInPanelCreateLocatedEntity";

export default function PanelCreateLocatedEntity() {
  const dispatch = useDispatch();
  // strings

  const title = "Bibliothèque d'objets";

  // handlers

  function handleClose() {
    dispatch(setEnabledDrawingMode(null));
    dispatch(setOpenedPanel("LISTING"));
  }

  // render

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={title} onClose={handleClose} />

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <SectionAnnotationTemplatesInPanelCreateLocatedEntity />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
