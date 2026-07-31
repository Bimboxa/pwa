import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Box } from "@mui/material";

import {
  selectSelectedItem,
  setSelectedItem,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ElevationBaseMapSelector from "./ElevationBaseMapSelector";
import ElevationBaseMapViewer from "./ElevationBaseMapViewer";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

// "BaseMap-viewer" sub-panel of the Élévation panel. Shown whenever the current
// selection is not a polyline / polygon being edited for its profile. Lets the
// user browse a vertical baseMap read-only and select the annotations drawn on
// it (the main 2D editor selection follows).
export default function PanelElevationBaseMapView() {
  const dispatch = useDispatch();

  // state

  const [selectedBaseMapId, setSelectedBaseMapId] = useState(null);

  // data

  const selectedItem = useSelector(selectSelectedItem);
  const selectedAnnotationId =
    selectedItem?.nodeType === "ANNOTATION" ? selectedItem.nodeId : null;

  // First vertical baseMap → default selection.
  const { value: baseMaps = [] } = useBaseMaps({});
  const firstVerticalBaseMapId = (baseMaps ?? []).find(
    (bm) => bm?.orientation === "VERTICAL"
  )?.id;

  // effect - default to the first vertical baseMap when nothing is selected

  useEffect(() => {
    if (!selectedBaseMapId && firstVerticalBaseMapId) {
      setSelectedBaseMapId(firstVerticalBaseMapId);
    }
  }, [selectedBaseMapId, firstVerticalBaseMapId]);

  // handlers

  function handleSelectAnnotation(annotation) {
    dispatch(
      setSelectedItem({
        id: annotation.id,
        type: "NODE",
        nodeId: annotation.id,
        nodeType: "ANNOTATION",
        annotationType: annotation.type,
        entityId: annotation.entityId,
        listingId: annotation.listingId,
        annotationTemplateId: annotation.annotationTemplateId,
        partId: null,
        partType: null,
      })
    );
    dispatch(setShowAnnotationsProperties(true));
  }

  // render

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      <Box sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <ElevationBaseMapSelector
          value={selectedBaseMapId}
          onChange={setSelectedBaseMapId}
        />
      </Box>

      <ElevationBaseMapViewer
        baseMapId={selectedBaseMapId}
        highlightAnnotationId={selectedAnnotationId}
        onSelectAnnotation={handleSelectAnnotation}
      />
    </BoxFlexVStretch>
  );
}
