import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, Button, Typography } from "@mui/material";
import PlaceIcon from "@mui/icons-material/Place";

import {
  selectSelectedItem,
  setSelectedItem,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";

import db from "App/db/db";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ElevationBaseMapSelector from "./ElevationBaseMapSelector";
import ElevationBaseMapViewer from "./ElevationBaseMapViewer";

import useRevolutionProxies from "Features/elevation/hooks/useRevolutionProxies";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

// "BaseMap-viewer" sub-panel of the Élévation panel. Shown whenever the current
// selection is NOT a plain (non-proxy) polyline being edited for its profile.
// Lets the user browse a vertical baseMap, select a revolution axis, and project
// it onto the plan (creating "donut" proxies). Selection is linked both ways:
//   - selecting a proxy on the plan switches this viewer to the source's baseMap
//     and highlights the source arc,
//   - clicking an arc here selects its proxy on the plan (main viewer).
export default function PanelElevationBaseMapView() {
  const dispatch = useDispatch();

  // state

  const [selectedBaseMapId, setSelectedBaseMapId] = useState(null);
  const [selectedAxisId, setSelectedAxisId] = useState(null);

  // data

  const selectedItem = useSelector(selectSelectedItem);
  const selectedAnnotationId =
    selectedItem?.nodeType === "ANNOTATION" ? selectedItem.nodeId : null;

  const { proxyBySourceId } = useRevolutionProxies();

  // First vertical baseMap → default selection when nothing else drives it.
  const { value: baseMaps = [] } = useBaseMaps({});
  const firstVerticalBaseMapId = (baseMaps ?? []).find(
    (bm) => bm?.orientation === "VERTICAL"
  )?.id;

  // When a proxy is selected (on the plan), resolve its source arc so we can
  // show the source's baseMap and highlight the arc (the "vice-versa" link).
  const selectedProxySource = useLiveQuery(async () => {
    if (!selectedAnnotationId) return null;
    const ann = await db.annotations.get(selectedAnnotationId);
    if (!ann?.isProxy || !ann.proxySourceAnnotationId) return null;
    const src = await db.annotations.get(ann.proxySourceAnnotationId);
    if (!src || src.deletedAt) return null;
    return { id: src.id, baseMapId: src.baseMapId };
  }, [selectedAnnotationId]);

  // effect - when a proxy is selected, switch the viewer to the source baseMap
  useEffect(() => {
    if (selectedProxySource?.baseMapId) {
      setSelectedBaseMapId(selectedProxySource.baseMapId);
      setSelectedAxisId(null);
    }
  }, [selectedProxySource?.baseMapId]);

  // effect - default to the first vertical baseMap when nothing is selected
  // (and no proxy is driving the view).
  useEffect(() => {
    if (!selectedBaseMapId && !selectedProxySource && firstVerticalBaseMapId) {
      setSelectedBaseMapId(firstVerticalBaseMapId);
    }
  }, [selectedBaseMapId, selectedProxySource, firstVerticalBaseMapId]);

  const highlightAnnotationId = selectedProxySource?.id ?? null;

  // handlers

  function handleSelectAnnotation(annotation) {
    // Clicking an arc that has a plan proxy selects the proxy (per spec); a bare
    // annotation just selects itself.
    const proxy = proxyBySourceId[annotation.id];
    const target = proxy ?? annotation;
    dispatch(
      setSelectedItem({
        id: target.id,
        type: "NODE",
        nodeId: target.id,
        nodeType: "ANNOTATION",
        annotationType: target.type,
        entityId: target.entityId,
        listingId: target.listingId,
        annotationTemplateId: target.annotationTemplateId,
        partId: null,
        partType: null,
      })
    );
    dispatch(setShowAnnotationsProperties(true));
  }

  function handlePlaceAxisOnPlan() {
    if (!selectedAxisId) return;
    dispatch(
      setNewAnnotation({
        type: "REVOLUTION_POINT",
        ...getDefaultsForShape("REVOLUTION_POINT"),
        revolutionAxisId: selectedAxisId,
      })
    );
    dispatch(setEnabledDrawingMode("ONE_CLICK"));
  }

  // render

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      <Box sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <ElevationBaseMapSelector
          value={selectedBaseMapId}
          onChange={(id) => {
            setSelectedBaseMapId(id);
            setSelectedAxisId(null);
          }}
        />
      </Box>

      <ElevationBaseMapViewer
        baseMapId={selectedBaseMapId}
        selectedAxisId={selectedAxisId}
        highlightAnnotationId={highlightAnnotationId}
        onSelectAxis={setSelectedAxisId}
        onSelectAnnotation={handleSelectAnnotation}
      />

      {selectedAxisId && (
        <Box sx={{ p: 1, borderTop: "1px solid", borderColor: "divider" }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<PlaceIcon />}
            onClick={handlePlaceAxisOnPlan}
          >
            {"Positionner l'axe sur la vue en plan"}
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5, textAlign: "center" }}
          >
            Cliquez ensuite sur le plan pour poser le centre.
          </Typography>
        </Box>
      )}
    </BoxFlexVStretch>
  );
}
