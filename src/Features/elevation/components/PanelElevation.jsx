import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedSegmentIndices,
  setEditedSegmentIndex,
  setHoveredSegmentIndex,
  setObservationSign,
} from "Features/elevation/elevationSlice";

import { Box, Typography, IconButton, TextField, Tooltip } from "@mui/material";
import { ArrowLeft } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PlanSelectorElevation from "./PlanSelectorElevation";
import ElevationEditor from "./ElevationEditor";

import useElevationAnnotation from "Features/elevation/hooks/useElevationAnnotation";
import getProjectableSegmentChain from "Features/elevation/utils/getProjectableSegmentChain";
import setAnnotationOffsetZService from "Features/elevation/services/setAnnotationOffsetZService";

export default function PanelElevation() {
  const dispatch = useDispatch();

  // data

  const {
    annotation,
    annotationId,
    isPolyline,
    points,
    meterByPx,
    height,
    offsetZ,
    color,
  } = useElevationAnnotation();

  const selectedSegmentIndices = useSelector(
    (s) => s.elevation.selectedSegmentIndices
  );
  const seedSegmentIndex = useSelector((s) => s.elevation.seedSegmentIndex);
  const editedSegmentIndex = useSelector(
    (s) => s.elevation.editedSegmentIndex
  );
  const hoveredSegmentIndex = useSelector(
    (s) => s.elevation.hoveredSegmentIndex
  );
  const observationSign = useSelector((s) => s.elevation.observationSign);
  const selectionAnnotationId = useSelector(
    (s) => s.elevation.selectionAnnotationId
  );

  // state

  const [showOffsetInput, setShowOffsetInput] = useState(false);
  const [offsetInput, setOffsetInput] = useState("");

  // effect - default selection = projectable chain of the first segment when
  // the selected annotation changes

  useEffect(() => {
    if (!isPolyline || !annotationId || points.length < 2) return;
    if (selectionAnnotationId === annotationId) return;
    dispatch(
      setSelectedSegmentIndices({
        segmentIndices: getProjectableSegmentChain(points, 0),
        seedSegmentIndex: 0,
        annotationId,
      })
    );
    dispatch(setHoveredSegmentIndex(null));
  }, [isPolyline, annotationId, points, selectionAnnotationId, dispatch]);

  // effect - keep the offset input in sync with the annotation

  useEffect(() => {
    setOffsetInput(String(offsetZ ?? 0));
  }, [offsetZ, annotationId]);

  // handlers

  function handleHoverSegment(i) {
    dispatch(setHoveredSegmentIndex(i));
  }

  // top plan view: pick the principal segment → recompute the projected chain
  // and re-project the editor (the chain depends on the principal segment)
  function handleSelectSeedSegment(i) {
    dispatch(
      setSelectedSegmentIndices({
        segmentIndices: getProjectableSegmentChain(points, i),
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

  function handleSubmitOffset() {
    const value = parseFloat(offsetInput);
    if (!Number.isNaN(value)) {
      setAnnotationOffsetZService({ annotationId, offsetZ: value, dispatch });
    }
    setShowOffsetInput(false);
  }

  // render

  if (!isPolyline) {
    return (
      <BoxFlexVStretch sx={{ height: 1 }}>
        <Box sx={{ p: 0.5, pl: 2 }}>
          <Typography variant="body2">Élévation</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Sélectionnez une annotation polyligne pour éditer son élévation.
          </Typography>
        </Box>
      </BoxFlexVStretch>
    );
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
        selectedSegmentIndices={selectedSegmentIndices}
        seedSegmentIndex={seedSegmentIndex}
        hoveredSegmentIndex={hoveredSegmentIndex}
        observationSign={observationSign}
        onHoverSegment={handleHoverSegment}
        onSelectSegment={handleSelectSeedSegment}
        onSetObservation={handleSetObservation}
      />

      <Box sx={{ position: "relative", flexGrow: 1, minHeight: 0, display: "flex" }}>
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

        {/* bottom-left arrow → set the annotation offset (offsetZ) */}
        <Box
          sx={{
            position: "absolute",
            left: 8,
            bottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Tooltip title="Définir l'offset (hauteur vs plan)">
            <IconButton
              size="small"
              onClick={() => setShowOffsetInput((v) => !v)}
              sx={{ bgcolor: "background.paper", boxShadow: 1 }}
            >
              <ArrowLeft />
            </IconButton>
          </Tooltip>
          {showOffsetInput && (
            <TextField
              size="small"
              type="number"
              label="Offset (m)"
              value={offsetInput}
              autoFocus
              onChange={(e) => setOffsetInput(e.target.value)}
              onBlur={handleSubmitOffset}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmitOffset();
              }}
              sx={{ width: 120, bgcolor: "background.paper" }}
            />
          )}
        </Box>
      </Box>
    </BoxFlexVStretch>
  );
}
