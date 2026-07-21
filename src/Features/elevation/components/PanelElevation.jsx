import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedSegmentIndices,
  setEditedSegmentIndex,
  setHoveredSegmentIndex,
  setObservationSign,
} from "Features/elevation/elevationSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PlanSelectorElevation from "./PlanSelectorElevation";
import ElevationBaseMapSelector from "./ElevationBaseMapSelector";
import ElevationEditor from "./ElevationEditor";
import PanelElevationBaseMapView from "./PanelElevationBaseMapView";

import useElevationAnnotation from "Features/elevation/hooks/useElevationAnnotation";
import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import getProjectableSegmentChain from "Features/elevation/utils/getProjectableSegmentChain";
import setElevationGuideService from "Features/elevation/services/setElevationGuideService";

export default function PanelElevation() {
  const dispatch = useDispatch();

  // data

  const {
    annotation,
    annotationId,
    isPolygon,
    isProfileTarget,
    points,
    closeLine,
    meterByPx,
    height,
    offsetZ,
    color,
    isoHeightLines,
  } = useElevationAnnotation();


  const selectedAnnotation = useSelectedAnnotation();

  // The profile editor sub-panel is for a plain (non-proxy) polyline or
  // polygon; any other selection (empty, a plan "donut" proxy…) shows the
  // baseMap viewer sub-panel.
  const showProfileEditor = isProfileTarget && !selectedAnnotation?.isProxy;

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
    if (!isProfileTarget || !annotationId || points.length < 2) return;
    if (selectionAnnotationId === annotationId) return;
    dispatch(
      setSelectedSegmentIndices({
        // POLYGON = a surface: project the FULL ring (closed silhouette), not
        // a projectable sub-chain.
        segmentIndices: isPolygon
          ? points.map((_, k) => k)
          : getProjectableSegmentChain(points, 0, { closeLine }),
        seedSegmentIndex: 0,
        annotationId,
      })
    );
    dispatch(setHoveredSegmentIndex(null));
  }, [
    isProfileTarget,
    isPolygon,
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
        // Full ring starting at the picked side (its start vertex becomes the
        // projection origin), so the seed segment lays horizontal.
        segmentIndices: isPolygon
          ? points.map((_, k) => (i + k) % points.length)
          : getProjectableSegmentChain(points, i, { closeLine }),
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

  // guide baseMap (elevation drawing used as a background guide to move the
  // isoHeight points): stored on the annotation as elevationGuide
  const elevationGuide = annotation?.elevationGuide ?? null;

  function handleGuideBaseMapChange(baseMapId) {
    setElevationGuideService({
      annotationId,
      guide: baseMapId ? { baseMapId } : null,
      dispatch,
    });
  }

  function handleGuideBaseMapRemove() {
    setElevationGuideService({ annotationId, guide: null, dispatch });
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
        isoLines={isoHeightLines}
        onHoverSegment={handleHoverSegment}
        onSelectSegment={handleSelectSeedSegment}
        onSetObservation={handleSetObservation}
      />

      {/* Guide baseMap: pick a VERTICAL baseMap (elevation drawing) shown as
          a background image in the editor below. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          py: 0.5,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: "background.paper",
        }}
      >
        <ElevationBaseMapSelector
          value={elevationGuide?.baseMapId ?? null}
          onChange={handleGuideBaseMapChange}
        />
        {elevationGuide?.baseMapId && (
          <Tooltip title="Retirer le fond de plan">
            <IconButton size="small" onClick={handleGuideBaseMapRemove}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

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
          isoLines={isoHeightLines}
          surfaceMode={isPolygon}
          elevationGuide={elevationGuide}
          onSelectSegment={handleSelectEditedSegment}
        />
      </Box>
    </BoxFlexVStretch>
  );
}
