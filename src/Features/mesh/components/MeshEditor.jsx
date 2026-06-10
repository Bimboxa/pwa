import { useRef, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { Box, Typography, Chip } from "@mui/material";

import {
  startMeshEditing,
  stopMeshEditing,
  setActiveTool,
  addMeshLine,
  setMeshLines,
  updateMeshLine,
  removeMeshLine,
  setSelectedLineId,
  setHoveredLineId,
} from "Features/mesh/meshSlice";

import { setEditedSegmentIndex } from "Features/elevation/elevationSlice";

import MapEditorViewport from "Features/mapEditorGeneric/components/MapEditorViewport";
import MeshSvg from "./MeshSvg";
import MeshElevationBackdrop from "./MeshElevationBackdrop";
import MeshToolbar from "./MeshToolbar";

import useElevationProfile from "Features/elevation/hooks/useElevationProfile";
import useMeshCells from "Features/mesh/hooks/useMeshCells";
import useMeshLineDrag from "Features/mesh/hooks/useMeshLineDrag";

import computeMeshCells from "Features/mesh/utils/computeMeshCells";
import gridMeshLines from "Features/mesh/utils/gridMeshLines";
import denormalizeMeshLines from "Features/mesh/utils/denormalizeMeshLines";
import { getBbox, lineForBbox } from "Features/mesh/utils/meshGeometry";
import saveMeshService from "Features/mesh/services/saveMeshService";

// Picks the elevation band (segment) whose projected X-band contains `x`
// (smallest band wins on overlap); falls back to the nearest. Returns the
// segment's pointIndex or null. Same model as ElevationEditor.
function pickSegmentAtX(x, vertices) {
  if (!vertices || vertices.length < 2) return null;
  let best = null;
  let bestWidth = Infinity;
  let nearest = null;
  let nearestDist = Infinity;
  for (let j = 0; j < vertices.length - 1; j++) {
    const a = vertices[j];
    const b = vertices[j + 1];
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    if (x >= lo && x <= hi) {
      const w = hi - lo;
      if (w < bestWidth) {
        bestWidth = w;
        best = a.segIndex;
      }
    } else {
      const d = x < lo ? lo - x : x - hi;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = a.segIndex;
      }
    }
  }
  return best != null ? best : nearest;
}

// Mesh edition canvas. Builds the outline to mesh (POLYGON → the polygon in map
// pixels; POLYLINE → its developed elevation, reusing useElevationProfile), then
// hosts the cut-line draw/drag flow and renders the live cells.
export default function MeshEditor({
  annotation,
  annotationId,
  mode,
  points,
  imageSize,
  meterByPx,
  height,
  offsetZ,
  color,
  meshLines, // persisted (normalized)
}) {
  const dispatch = useDispatch();
  const viewportRef = useRef(null);

  // mesh slice state
  const editing = useSelector((s) => s.mesh.editing);
  const activeTool = useSelector((s) => s.mesh.activeTool);
  const draftMeshLines = useSelector((s) => s.mesh.draftMeshLines);
  const selectedLineId = useSelector((s) => s.mesh.selectedLineId);
  const hoveredLineId = useSelector((s) => s.mesh.hoveredLineId);

  // elevation slice state (POLYLINE only — reused from the Élévation tool)
  const selectedSegmentIndices = useSelector(
    (s) => s.elevation.selectedSegmentIndices
  );
  const seedSegmentIndex = useSelector((s) => s.elevation.seedSegmentIndex);
  const observationSign = useSelector((s) => s.elevation.observationSign);
  const editedSegmentIndex = useSelector(
    (s) => s.elevation.editedSegmentIndex
  );
  const hoveredSegmentIndex = useSelector(
    (s) => s.elevation.hoveredSegmentIndex
  );

  const { vertices } = useElevationProfile({
    points: mode === "POLYLINE" ? points : [],
    selectedSegmentIndices,
    seedSegmentIndex,
    observationSign,
    meterByPx,
    height,
    offsetZ,
  });

  // --- outline + chain (developed mapping for POLYLINE) ---
  const { outlinePoints, chain, developedRange } = useMemo(() => {
    if (mode === "POLYGON") {
      return {
        outlinePoints: (points ?? []).map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
        })),
        chain: null,
        developedRange: null,
      };
    }
    if (mode === "POLYLINE" && vertices?.length >= 2) {
      const top = vertices.map((v) => ({ x: v.x, y: v.topY }));
      const bottom = [...vertices].reverse().map((v) => ({ x: v.x, y: v.bottomY }));
      const xs = vertices.map((v) => v.x);
      return {
        outlinePoints: [...top, ...bottom],
        // plan coords live on the vertex (px/py) so sampled arc points map back
        // to their curve position, not to a missing points[null] anchor.
        chain: vertices.map((v) => ({ x: v.x, plan: { x: v.px, y: v.py } })),
        developedRange: { xMin: Math.min(...xs), xMax: Math.max(...xs) },
      };
    }
    return { outlinePoints: [], chain: null, developedRange: null };
  }, [mode, points, vertices]);

  const bbox = useMemo(() => getBbox(outlinePoints), [outlinePoints]);

  // POLYLINE: the developed X-range of the selected (editable) band — used to
  // scope the cotes to that band only.
  const coteXRange = useMemo(() => {
    if (mode !== "POLYLINE" || !vertices?.length || editedSegmentIndex == null)
      return null;
    // The edited band may be split into several sampled sub-bands (an arc): span
    // every sub-band whose owner is editedSegmentIndex.
    let min = Infinity;
    let max = -Infinity;
    for (let j = 0; j < vertices.length - 1; j++) {
      if (vertices[j].segIndex !== editedSegmentIndex) continue;
      min = Math.min(min, vertices[j].x, vertices[j + 1].x);
      max = Math.max(max, vertices[j].x, vertices[j + 1].x);
    }
    if (min === Infinity) return null;
    return { min, max };
  }, [mode, vertices, editedSegmentIndex]);

  // lines shown: draft while editing, else the persisted mesh (denormalized)
  const persistedWorldLines = useMemo(
    () =>
      denormalizeMeshLines(meshLines, {
        mode,
        imageSize,
        developedRange,
        meterByPx,
      }),
    [meshLines, mode, imageSize, developedRange, meterByPx]
  );
  const linesForDisplay = editing ? draftMeshLines : persistedWorldLines;

  const cells = useMeshCells({
    outlinePoints,
    meshLines: linesForDisplay,
    meterByPx,
  });

  const { startLineDrag } = useMeshLineDrag({ viewportRef });

  // --- fit-contain camera (refit when the outline/projection changes) ---
  const fitKey = `${annotationId}:${mode}:${seedSegmentIndex}:${observationSign}:${bbox.minX?.toFixed(
    0
  )},${bbox.minY?.toFixed(0)},${bbox.maxX?.toFixed(0)},${bbox.maxY?.toFixed(0)}`;

  useEffect(() => {
    if (!outlinePoints?.length || !viewportRef.current) return;
    let raf;
    const fit = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      const { width: vw, height: vh } = vp.getViewportSize();
      if (!vw || !vh) {
        raf = requestAnimationFrame(fit);
        return;
      }
      const w = Math.max(bbox.maxX - bbox.minX, 1);
      const h = Math.max(bbox.maxY - bbox.minY, 1);
      // generous margins to keep the dimension bands + labels in view
      const fitMinX = bbox.minX - w * 0.22 - 24;
      const fitMaxX = bbox.maxX + w * 0.08 + 16;
      const fitMinY = bbox.minY - h * 0.12 - 16;
      const fitMaxY = bbox.maxY + h * 0.22 + 24;
      const bw = Math.max(fitMaxX - fitMinX, 1);
      const bh = Math.max(fitMaxY - fitMinY, 1);
      const pad = 16;
      const k = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh) || 1;
      const cx = (fitMinX + fitMaxX) / 2;
      const cy = (fitMinY + fitMaxY) / 2;
      vp.setCameraMatrix({ x: vw / 2 - cx * k, y: vh / 2 - cy * k, k });
    };
    fit();
    return () => raf && cancelAnimationFrame(raf);
  }, [fitKey]);

  // --- delete selected cut line on Delete / Backspace ---
  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = e.target?.tagName;
      // don't hijack the key while typing in a dimension field
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable)
        return;
      if (!selectedLineId) return;
      e.preventDefault();
      dispatch(removeMeshLine(selectedLineId));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, selectedLineId, dispatch]);

  // --- handlers ---

  const handleStartEdit = useCallback(() => {
    dispatch(
      startMeshEditing({
        annotationId,
        meshLines: denormalizeMeshLines(meshLines, {
          mode,
          imageSize,
          developedRange,
          meterByPx,
        }),
      })
    );
  }, [
    dispatch,
    annotationId,
    meshLines,
    mode,
    imageSize,
    developedRange,
    meterByPx,
  ]);

  const handleCancel = useCallback(() => {
    dispatch(stopMeshEditing());
  }, [dispatch]);

  const handleSave = useCallback(async () => {
    const computed = computeMeshCells(outlinePoints, draftMeshLines, {
      meterByPx,
    });
    await saveMeshService({
      parentAnnotation: annotation,
      mode,
      cells: computed,
      draftMeshLines,
      imageSize,
      meterByPx,
      elevation: mode === "POLYLINE" ? { chain, developedRange } : undefined,
      dispatch,
    });
    dispatch(stopMeshEditing());
  }, [
    outlinePoints,
    draftMeshLines,
    meterByPx,
    annotation,
    mode,
    imageSize,
    chain,
    developedRange,
    dispatch,
  ]);

  const handleSelectTool = useCallback(
    (value) => {
      if (value === "GRID_2x2") {
        dispatch(
          setMeshLines(gridMeshLines({ outlinePoints, rows: 2, cols: 2 }))
        );
        dispatch(setActiveTool("SELECT"));
        return;
      }
      dispatch(setActiveTool(value));
    },
    [dispatch, outlinePoints]
  );

  // "Maillage par arête" (POLYLINE): add a vertical cut line at each interior
  // segment edge of the developed elevation, so each band becomes a maille.
  const handleMeshByEdges = useCallback(() => {
    if (!vertices?.length) return;
    // Cut at real segment edges only (anchors), not at every sampled arc point.
    const xs = [
      ...new Set(
        vertices
          .filter((v) => v.pointIndex != null)
          .map((v) => Math.round(v.x * 1000) / 1000)
      ),
    ]
      .sort((a, b) => a - b)
      .slice(1, -1); // exclude the two outer edges
    const newLines = xs
      .filter(
        (x) =>
          !draftMeshLines.some(
            (l) =>
              l.orientation === "VERTICAL" &&
              Math.abs((l.p1.x + l.p2.x) / 2 - x) < 0.5
          )
      )
      .map((x) => ({
        id: nanoid(),
        orientation: "VERTICAL",
        ...lineForBbox("VERTICAL", x, bbox),
      }));
    if (newLines.length)
      dispatch(setMeshLines([...draftMeshLines, ...newLines]));
  }, [vertices, draftMeshLines, bbox, dispatch]);

  // Reset the mesh of the current band (POLYLINE) by removing the vertical cut
  // lines strictly inside the selected band — collapsing it back to a single
  // maille. For POLYGON (no band), clears all cut lines.
  const handleReset = useCallback(() => {
    if (coteXRange) {
      const { min, max } = coteXRange;
      dispatch(
        setMeshLines(
          draftMeshLines.filter((l) => {
            if (l.orientation === "HORIZONTAL") return true; // global, keep
            const mx = (l.p1.x + l.p2.x) / 2;
            return !(mx > min + 1e-6 && mx < max - 1e-6);
          })
        )
      );
    } else {
      dispatch(setMeshLines([]));
    }
  }, [coteXRange, draftMeshLines, dispatch]);

  const handleWorldClick = useCallback(
    ({ worldPos }) => {
      if (activeTool === "ADD_VERTICAL") {
        const seg = lineForBbox("VERTICAL", worldPos.x, bbox);
        dispatch(addMeshLine({ orientation: "VERTICAL", ...seg }));
      } else if (activeTool === "ADD_HORIZONTAL") {
        const seg = lineForBbox("HORIZONTAL", worldPos.y, bbox);
        dispatch(addMeshLine({ orientation: "HORIZONTAL", ...seg }));
      } else {
        // SELECT: clicking the elevation picks the editable band (POLYLINE)
        if (mode === "POLYLINE" && vertices?.length >= 2) {
          const seg = pickSegmentAtX(worldPos.x, vertices);
          if (seg != null) dispatch(setEditedSegmentIndex(seg));
        }
        dispatch(setSelectedLineId(null));
      }
    },
    [activeTool, bbox, dispatch, mode, vertices]
  );

  const handleCommitLinePosition = useCallback(
    (lineId, axis, newMidScalar) => {
      const line = draftMeshLines.find((l) => l.id === lineId);
      if (!line) return;
      const mid =
        axis === "x"
          ? (line.p1.x + line.p2.x) / 2
          : (line.p1.y + line.p2.y) / 2;
      const delta = newMidScalar - mid;
      const shift = (p) =>
        axis === "x" ? { x: p.x + delta, y: p.y } : { x: p.x, y: p.y + delta };
      dispatch(
        updateMeshLine({
          id: lineId,
          p1: shift(line.p1),
          p2: shift(line.p2),
        })
      );
    },
    [draftMeshLines, dispatch]
  );

  const shouldDisablePan = (e) => Boolean(e.target?.dataset?.meshHandle);

  const isPlacing =
    activeTool === "ADD_VERTICAL" || activeTool === "ADD_HORIZONTAL";

  // --- render ---

  if (!outlinePoints || outlinePoints.length < 3) {
    return (
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {mode === "POLYLINE"
            ? "Sélectionnez un segment dans l'aperçu pour voir l'élévation à mailler."
            : "Géométrie insuffisante pour mailler cette annotation."}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ position: "relative", flexGrow: 1, minHeight: 0 }}>
        <MapEditorViewport
          ref={viewportRef}
          shouldDisablePan={shouldDisablePan}
          onWorldClick={handleWorldClick}
        >
          {mode === "POLYLINE" && (
            <MeshElevationBackdrop
              vertices={vertices}
              editedSegmentIndex={editedSegmentIndex}
              hoveredSegmentIndex={hoveredSegmentIndex}
              color={color}
            />
          )}
          <MeshSvg
            color={color}
            meterByPx={meterByPx}
            outlinePoints={outlinePoints}
            bbox={bbox}
            cells={cells}
            meshLines={linesForDisplay}
            editing={editing}
            selectedLineId={selectedLineId}
            hoveredLineId={hoveredLineId}
            onLineMouseDown={startLineDrag}
            onHoverLine={(id) => dispatch(setHoveredLineId(id))}
            onCommitLinePosition={handleCommitLinePosition}
            showOutline={mode !== "POLYLINE"}
            cellFill={mode !== "POLYLINE"}
            coteXRange={coteXRange}
          />
        </MapEditorViewport>

        {isPlacing && (
          <Box
            sx={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              bgcolor: "rgba(0,0,0,0.8)",
              color: "#fff",
              borderRadius: 2,
              px: 2,
              py: 1,
              display: "flex",
              gap: 1.5,
              alignItems: "center",
            }}
          >
            <Typography variant="body2">
              Cliquez sur le plan pour placer
            </Typography>
            <Chip
              label="Annuler"
              size="small"
              onClick={() => dispatch(setActiveTool("SELECT"))}
              sx={{ color: "warning.light", cursor: "pointer" }}
              variant="outlined"
            />
          </Box>
        )}
      </Box>

      <MeshToolbar
        editing={editing}
        activeTool={activeTool}
        canSave={cells?.length > 0}
        showMeshByEdges={mode === "POLYLINE"}
        resetLabel={
          coteXRange ? "Réinitialiser la bande" : "Réinitialiser le maillage"
        }
        onStartEdit={handleStartEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        onSelectTool={handleSelectTool}
        onMeshByEdges={handleMeshByEdges}
        onReset={handleReset}
      />
    </Box>
  );
}
