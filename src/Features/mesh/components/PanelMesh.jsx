import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedSegmentIndices,
  setHoveredSegmentIndex,
  setObservationSign,
} from "Features/elevation/elevationSlice";
import {
  resetMesh,
  startMeshEditing,
  stopMeshEditing,
} from "Features/mesh/meshSlice";
import { setElevationWidth } from "Features/rightPanel/rightPanelSlice";

import { Box, Typography, IconButton, Button, Tooltip } from "@mui/material";
import {
  Edit,
  OpenInFull,
  CloseFullscreen,
  Save,
  RestartAlt,
  Close,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PlanSelectorElevation from "Features/elevation/components/PlanSelectorElevation";
import MeshEditor from "./MeshEditor";

import useMeshAnnotation from "Features/mesh/hooks/useMeshAnnotation";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";
import getProjectableSegmentChain from "Features/elevation/utils/getProjectableSegmentChain";

// "Maillage" panel. POLYGON → mesh the polygon directly; POLYLINE → mesh its
// developed elevation (reusing the Élévation tool's plan selector + projection).
export default function PanelMesh() {
  const dispatch = useDispatch();

  // data

  const {
    annotation,
    annotationId,
    mode,
    points,
    closeLine,
    imageSize,
    meterByPx,
    height,
    offsetZ,
    color,
    meshLines,
    meshLinesBySegment,
    selectedMailleLabel,
    selectedMailleId,
  } = useMeshAnnotation();

  const selectedSegmentIndices = useSelector(
    (s) => s.elevation.selectedSegmentIndices
  );
  const seedSegmentIndex = useSelector((s) => s.elevation.seedSegmentIndex);
  const hoveredSegmentIndex = useSelector(
    (s) => s.elevation.hoveredSegmentIndex
  );
  const observationSign = useSelector((s) => s.elevation.observationSign);
  const meshSelectionAnnotationId = useSelector(
    (s) => s.mesh.selectionAnnotationId
  );
  const editing = useSelector((s) => s.mesh.editing);
  const canSave = useSelector((s) => s.mesh.canSave);
  const panelWidth = useSelector((s) => s.rightPanel.elevationWidth);

  // imperative handle to the editor (it owns the save/reset geometry); the
  // header action buttons call into it.
  const meshEditorRef = useRef(null);

  // effect - reset mesh edition when the selected annotation changes
  useEffect(() => {
    if (
      meshSelectionAnnotationId &&
      meshSelectionAnnotationId !== annotationId
    ) {
      dispatch(resetMesh());
    }
  }, [annotationId, meshSelectionAnnotationId, dispatch]);

  // Segment of the currently selected maille (carried by its relation row),
  // null when no maille is selected or it predates per-segment storage.
  const { rows: meshRels } = useMeshCellRelations();
  const selectedMailleSeed = useMemo(() => {
    if (!selectedMailleId) return null;
    const rel = (meshRels ?? []).find(
      (r) => r.meshCellAnnotationId === selectedMailleId
    );
    return Number.isInteger(rel?.seedSegmentIndex) ? rel.seedSegmentIndex : null;
  }, [meshRels, selectedMailleId]);

  // effect - default projectable chain (POLYLINE):
  //   - a maille is selected → jump to its segment (e.g. clicked in 3D);
  //   - a freshly opened annotation → first segment;
  //   - a maille DESELECTED on the same annotation → keep the current segment
  //     (don't snap back to 0).
  // Manually picking a segment later doesn't change selectedMailleSeed, so this
  // effect doesn't re-fire and the manual choice is preserved.
  const prevAnnotationIdRef = useRef(null);
  useEffect(() => {
    if (mode !== "POLYLINE" || !annotationId || points.length < 2) {
      prevAnnotationIdRef.current = annotationId;
      return;
    }
    const annotationChanged = prevAnnotationIdRef.current !== annotationId;
    prevAnnotationIdRef.current = annotationId;

    let targetSeed;
    if (selectedMailleSeed != null) targetSeed = selectedMailleSeed;
    else if (annotationChanged) targetSeed = 0;
    else return; // maille deselected on same annotation → keep current segment

    // Developed view = the projectable chain (the seed segment principal +
    // its neighbours), so neighbouring segments' mailles stay visible for
    // context. Meshing/binding is still per single segment (the seed).
    dispatch(
      setSelectedSegmentIndices({
        segmentIndices: getProjectableSegmentChain(points, targetSeed, {
          closeLine,
        }),
        seedSegmentIndex: targetSeed,
        annotationId,
      })
    );
    dispatch(setHoveredSegmentIndex(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, annotationId, closeLine, selectedMailleSeed, dispatch]);

  // handlers (POLYLINE plan selector — reuses the elevation slice)

  function handleSelectSeedSegment(i) {
    // chain view (neighbours visible) seeded at the picked segment
    dispatch(
      setSelectedSegmentIndices({
        segmentIndices: getProjectableSegmentChain(points, i, { closeLine }),
        seedSegmentIndex: i,
        annotationId,
      })
    );
  }

  // helpers - panel width toggle (half screen ↔ normal)

  const halfScreen = Math.round(window.innerWidth / 2);
  const isExpanded = panelWidth >= halfScreen - 8;

  function handleToggleWidth() {
    dispatch(setElevationWidth(isExpanded ? 400 : halfScreen));
  }

  function handleStartEdit() {
    dispatch(startMeshEditing({ annotationId }));
  }

  // render

  // while editing, the first line becomes the mesh action bar
  const header = editing ? (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        px: 1,
        py: 0.5,
      }}
    >
      <Button
        size="small"
        variant="outlined"
        startIcon={<RestartAlt />}
        onClick={() => meshEditorRef.current?.reset()}
      >
        Réinitialiser
      </Button>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Close />}
          onClick={() => dispatch(stopMeshEditing())}
        >
          Annuler
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<Save />}
          disabled={!canSave}
          onClick={() => meshEditorRef.current?.save()}
        >
          Enregistrer
        </Button>
      </Box>
    </Box>
  ) : (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 0.5, pr: 1, py: 0.5 }}>
      <Tooltip
        title={isExpanded ? "Réduire le panneau" : "Élargir le panneau (demi-écran)"}
      >
        <IconButton size="small" onClick={handleToggleWidth}>
          {isExpanded ? (
            <CloseFullscreen fontSize="small" />
          ) : (
            <OpenInFull fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <Typography variant="body2" noWrap>
        Maillage
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      <Button size="small" startIcon={<Edit />} onClick={handleStartEdit}>
        Editer
      </Button>
    </Box>
  );

  if (!mode) {
    return (
      <BoxFlexVStretch sx={{ height: 1 }}>
        <Box sx={{ p: 0.5, pl: 2 }}>
          <Typography variant="body2">Maillage</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Sélectionnez une annotation polygone ou polyligne pour la mailler.
          </Typography>
        </Box>
      </BoxFlexVStretch>
    );
  }

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      {header}

      {mode === "POLYLINE" && (
        <PlanSelectorElevation
          points={points}
          closeLine={closeLine}
          selectedSegmentIndices={selectedSegmentIndices}
          seedSegmentIndex={seedSegmentIndex}
          hoveredSegmentIndex={hoveredSegmentIndex}
          observationSign={observationSign}
          onHoverSegment={(i) => dispatch(setHoveredSegmentIndex(i))}
          onSelectSegment={handleSelectSeedSegment}
          onSetObservation={(s) => dispatch(setObservationSign(s))}
        />
      )}

      <Box sx={{ position: "relative", flexGrow: 1, minHeight: 0, display: "flex" }}>
        <MeshEditor
          ref={meshEditorRef}
          annotation={annotation}
          annotationId={annotationId}
          mode={mode}
          points={points}
          imageSize={imageSize}
          meterByPx={meterByPx}
          height={height}
          offsetZ={offsetZ}
          color={color}
          meshLines={meshLines}
          meshLinesBySegment={meshLinesBySegment}
          selectedMailleLabel={selectedMailleLabel}
        />
      </Box>
    </BoxFlexVStretch>
  );
}
