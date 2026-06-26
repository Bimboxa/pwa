import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedSegmentIndices,
  setEditedSegmentIndex,
  setHoveredSegmentIndex,
  setObservationSign,
} from "Features/elevation/elevationSlice";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PlanSelectorElevation from "./PlanSelectorElevation";
import ElevationEditor from "./ElevationEditor";
import PanelElevationBaseMapView from "./PanelElevationBaseMapView";

import useElevationAnnotation from "Features/elevation/hooks/useElevationAnnotation";
import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import getProjectableSegmentChain from "Features/elevation/utils/getProjectableSegmentChain";

export default function PanelElevation() {
  const dispatch = useDispatch();

  // data

  const {
    annotation,
    annotationId,
    isPolyline,
    points,
    closeLine,
    meterByPx,
    height,
    offsetZ,
    color,
  } = useElevationAnnotation();

  const selectedAnnotation = useSelectedAnnotation();

  // The profile editor sub-panel is for a plain (non-proxy) polyline; any other
  // selection (empty, a plan "donut" proxy, a non-polyline…) shows the baseMap
  // viewer sub-panel.
  const showProfileEditor = isPolyline && !selectedAnnotation?.isProxy;

  const selectedSegmentIndices = useSelector(
    (s) => s.elevation.selectedSegmentIndices
  );
  const seedSegmentIndex = useSelector((s) => s.elevation.seedSegmentIndex);
  const editedSegmentIndex = useSelector((s) => s.elevation.editedSegmentIndex);
  const hoveredSegmentIndex = useSelector(
    (s) => s.elevation.hoveredSegmentIndex
  );
  const observationSign = useSelector((s) => s.elevation.observationSign);
  const selectionAnnotationId = useSelector(
    (s) => s.elevation.selectionAnnotationId
  );

  // effect - default selection = projectable chain of the first segment when
  // the selected annotation changes

  useEffect(() => {
    if (!isPolyline || !annotationId || points.length < 2) return;
    if (selectionAnnotationId === annotationId) return;
    dispatch(
      setSelectedSegmentIndices({
        segmentIndices: getProjectableSegmentChain(points, 0, { closeLine }),
        seedSegmentIndex: 0,
        annotationId,
      })
    );
    dispatch(setHoveredSegmentIndex(null));
  }, [
    isPolyline,
    annotationId,
    points,
    closeLine,
    selectionAnnotationId,
    dispatch,
  ]);

  // handlers

  function handleHoverSegment(i) {
    dispatch(setHoveredSegmentIndex(i));
  }

  // top plan view: pick the principal segment → recompute the projected chain
  // and re-project the editor (the chain depends on the principal segment)
  function handleSelectSeedSegment(i) {
    dispatch(
      setSelectedSegmentIndices({
        segmentIndices: getProjectableSegmentChain(points, i, { closeLine }),
        seedSegmentIndex: i,
        annotationId,
      })
    );
  }

  // band click in the editor: only change which vertices are editable (keeps
  // the projection/layout stable)
  function handleSelectEditedSegment(i) {
    dispatch(setEditedSegmentIndex(i));
  }

  // arrows on each side of the principal segment: pick the viewing side
  function handleSetObservation(sign) {
    dispatch(setObservationSign(sign));
  }

  // render

  if (!showProfileEditor) {
    return <PanelElevationBaseMapView />;
  }

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      <Box sx={{ p: 0.5, pl: 2 }}>
        <Typography variant="body2" noWrap>
          {`Élévation — ${annotation?.label ?? annotation?.templateLabel ?? ""}`}
        </Typography>
      </Box>

      <PlanSelectorElevation
        points={points}
        closeLine={closeLine}
        selectedSegmentIndices={selectedSegmentIndices}
        seedSegmentIndex={seedSegmentIndex}
        hoveredSegmentIndex={hoveredSegmentIndex}
        observationSign={observationSign}
        onHoverSegment={handleHoverSegment}
        onSelectSegment={handleSelectSeedSegment}
        onSetObservation={handleSetObservation}
      />

      <Box
        sx={{
          position: "relative",
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
        }}
      >
        <ElevationEditor
          annotationId={annotationId}
          points={points}
          selectedSegmentIndices={selectedSegmentIndices}
          seedSegmentIndex={seedSegmentIndex}
          editedSegmentIndex={editedSegmentIndex}
          observationSign={observationSign}
          meterByPx={meterByPx}
          height={height}
          offsetZ={offsetZ}
          color={color}
          onSelectSegment={handleSelectEditedSegment}
        />
      </Box>
    </BoxFlexVStretch>
  );
}
