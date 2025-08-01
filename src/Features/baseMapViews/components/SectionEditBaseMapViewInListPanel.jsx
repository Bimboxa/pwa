import { useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  setEditedBaseMapView,
  setIsEditingBaseMapView,
  setSelectedBaseMapViewId,
} from "../baseMapViewsSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useCreateBaseMapView from "Features/baseMapViews/hooks/useCreateBaseMapView";

import { Box } from "@mui/material";

import FormBaseMapViewVariantEdit from "./FormBaseMapViewVariantEdit";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderListPanel from "Features/listPanel/components/HeaderListPanel";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import useUpdateBaseMapView from "../hooks/useUpdateBaseMapView";

export default function SectionEditBaseMapViewInListPanel() {
  const dispatch = useDispatch();
  const createContainerRef = useRef();

  // strings

  const title = "Modifier le plan";
  const createS = "Enregistrer";

  // data

  const { value: baseMaps } = useBaseMaps();
  const updateBaseMapView = useUpdateBaseMapView();

  const editedBaseMapView = useSelector(
    (s) => s.baseMapViews.editedBaseMapView
  );

  // handlers

  function handleChange(newBaseMapView) {
    dispatch(setEditedBaseMapView(newBaseMapView));
  }

  async function handleSave() {
    console.log("[savingBaseMapView]", editedBaseMapView);

    await updateBaseMapView({ updates: editedBaseMapView });
    dispatch(setIsEditingBaseMapView(false));
    dispatch(setSelectedBaseMapViewId(null));
  }

  return (
    <BoxFlexVStretch>
      <Box
        ref={createContainerRef}
        sx={{
          width: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <HeaderTitleClose
          title={title}
          onClose={() => dispatch(setIsEditingBaseMapView(false))}
        />
        <FormBaseMapViewVariantEdit
          baseMapView={editedBaseMapView}
          onChange={handleChange}
          baseMaps={baseMaps}
          createContainerEl={createContainerRef.current}
        />
        <ButtonInPanelV2 label={createS} onClick={handleSave} />
      </Box>
    </BoxFlexVStretch>
  );
}
