import {
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { Box, Typography } from "@mui/material";

import {
  stopMeshEditing,
  setActiveTool,
  addMeshLine,
  setMeshLines,
  updateMeshLine,
  removeMeshLine,
  setMeshGridCell,
  setMeshCanSave,
  setSelectedLineId,
  setHoveredLineId,
} from "Features/mesh/meshSlice";

import { setEditedSegmentIndex } from "Features/elevation/elevationSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import MapEditorViewport from "Features/mapEditorGeneric/components/MapEditorViewport";
import MeshSvg from "./MeshSvg";
import MeshElevationBackdrop from "./MeshElevationBackdrop";
import MeshToolbar from "./MeshToolbar";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";
import useElevationProfile from "Features/elevation/hooks/useElevationProfile";
import useMeshCells from "Features/mesh/hooks/useMeshCells";
import useMeshCellLabelOffset from "Features/mesh/hooks/useMeshCellLabelOffset";
import useMeshLineDrag from "Features/mesh/hooks/useMeshLineDrag";

import computeMeshCells from "Features/mesh/utils/computeMeshCells";
import denormalizeMeshLines from "Features/mesh/utils/denormalizeMeshLines";
import {
  getBbox,
  lineForBbox,
  buildSnapCandidates,
  snapToCandidates,
} from "Features/mesh/utils/meshGeometry";
import saveMeshService from "Features/mesh/services/saveMeshService";
import renameMeshCellService from "Features/mesh/services/renameMeshCellService";
import deleteMeshSegmentService from "Features/mesh/services/deleteMeshSegmentService";

// snap radius for the line tools, in screen pixels (converted to world units
// via the live zoom at use time)
const SNAP_PX = 10;

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

// Parse the trailing/embedded number of a maille label ("M12" → 12), 0 if none.
function labelNum(label) {
  const m = /(\d+)/.exec(label || "");
  return m ? parseInt(m[1], 10) : 0;
}

// Build the selection payload for a maille (mesh cell) annotation.
function meshCellSelectionItem(m) {
  return {
    id: m.id,
    nodeId: m.id,
    type: "NODE",
    nodeType: "ANNOTATION",
    annotationType: m.type,
    entityId: m.entityId,
    listingId: m.listingId,
    annotationTemplateId: m.annotationTemplateId,
    isMeshCell: true,
    parentAnnotationId: m.parentAnnotationId,
    partId: null,
    partType: null,
  };
}

// Selection payload for the parent (meshed) annotation itself — used to
// "deselect" a maille while keeping the surface selected (panel stays open).
function annotationSelectionItem(a) {
  return {
    id: a.id,
    nodeId: a.id,
    type: "NODE",
    nodeType: "ANNOTATION",
    annotationType: a.type,
    entityId: a.entityId,
    listingId: a.listingId,
    annotationTemplateId: a.annotationTemplateId,
    isMeshCell: false,
    parentAnnotationId: null,
    partId: null,
    partType: null,
  };
}

// Mesh edition canvas. Builds the outline to mesh (POLYGON → the polygon in map
// pixels; POLYLINE → its developed elevation, reusing useElevationProfile), then
// hosts the cut-line draw/drag flow and renders the live cells.
function MeshEditor(
  {
    annotation,
    annotationId,
    mode,
    points,
    imageSize,
    meterByPx,
    height,
    offsetZ,
    color,
    meshLines, // POLYGON: persisted (normalized) cut lines
    meshLinesBySegment, // POLYLINE: { [seedSegmentIndex]: normalizedLines[] }
    selectedMailleLabel = null, // M-label of the selected maille (highlight it)
  },
  ref
) {
  const dispatch = useDispatch();

  // panel-local highlight of the hovered cell (by its M-label)
  const [hoveredCellLabel, setHoveredCellLabel] = useState(null);
  const viewportRef = useRef(null);

  // line-tool drawing state (local — not persisted): the snapped cursor world
  // position, the snapped target marker, and the first endpoint of a FREE line.
  const [preview, setPreview] = useState(null);
  const [snapPoint, setSnapPoint] = useState(null);
  // FREE line first endpoint: kept in a ref (read synchronously in the click
  // handler, which the viewport invokes from a deferred window listener) AND in
  // state (for the preview render).
  const [freeStart, setFreeStart] = useState(null);
  const freeStartRef = useRef(null);
  const setFree = useCallback((v) => {
    freeStartRef.current = v;
    setFreeStart(v);
  }, []);

  // live map zoom → keeps the elevation backdrop recap gap/margins constant in
  // screen pixels at any zoom level (see MeshElevationBackdrop)
  const [zoom, setZoom] = useState(1);
  const handleCameraChange = useCallback((m) => {
    setZoom((z) => (z === m.k ? z : m.k));
  }, []);

  // mesh slice state
  const editing = useSelector((s) => s.mesh.editing);
  const activeTool = useSelector((s) => s.mesh.activeTool);
  const draftMeshLines = useSelector((s) => s.mesh.draftMeshLines);
  const selectedLineId = useSelector((s) => s.mesh.selectedLineId);
  const hoveredLineId = useSelector((s) => s.mesh.hoveredLineId);
  const gridCell = useSelector((s) => s.mesh.gridCell);

  // elevation slice state (POLYLINE only — reused from the Élévation tool)
  const selectedSegmentIndices = useSelector(
    (s) => s.elevation.selectedSegmentIndices
  );
  const seedSegmentIndex = useSelector((s) => s.elevation.seedSegmentIndex);
  const observationSign = useSelector((s) => s.elevation.observationSign);
  const editedSegmentIndex = useSelector((s) => s.elevation.editedSegmentIndex);
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
      const bottom = [...vertices]
        .reverse()
        .map((v) => ({ x: v.x, y: v.bottomY }));
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

  // --- per-segment developed geometry (POLYLINE) ---
  // Each chain segment's own outline portion + developed x-range, so its cut
  // lines are stored / denormalized in ITS OWN range (independent of the chain)
  // and every segment of the visible chain can be drawn side by side. Vertices
  // carry `segIndex` = the segment STARTING at that vertex (null on the last).
  const segmentsInfo = useMemo(() => {
    if (mode !== "POLYLINE" || !(vertices?.length >= 2)) return [];
    const idxBySeg = new Map();
    vertices.forEach((v, j) => {
      if (v.segIndex == null) return;
      if (!idxBySeg.has(v.segIndex)) idxBySeg.set(v.segIndex, []);
      idxBySeg.get(v.segIndex).push(j);
    });
    const out = [];
    for (const [segIndex, idxs] of idxBySeg) {
      const lo = Math.min(...idxs);
      const hi = Math.min(Math.max(...idxs) + 1, vertices.length - 1);
      const tops = [];
      const bottoms = [];
      let xMin = Infinity;
      let xMax = -Infinity;
      for (let k = lo; k <= hi; k++) {
        tops.push({ x: vertices[k].x, y: vertices[k].topY });
        bottoms.push({ x: vertices[k].x, y: vertices[k].bottomY });
        xMin = Math.min(xMin, vertices[k].x);
        xMax = Math.max(xMax, vertices[k].x);
      }
      out.push({
        segIndex,
        outline: [...tops, ...bottoms.reverse()],
        range: { xMin, xMax },
      });
    }
    out.sort((a, b) => a.range.xMin - b.range.xMin);
    return out;
  }, [mode, vertices]);

  // seed (editable / principal) segment's range + outline
  const seedSegmentRange = useMemo(() => {
    const info = segmentsInfo.find((s) => s.segIndex === seedSegmentIndex);
    return info?.range ?? developedRange;
  }, [segmentsInfo, seedSegmentIndex, developedRange]);
  const seedOutline = useMemo(() => {
    if (mode === "POLYGON") return outlinePoints;
    const info = segmentsInfo.find((s) => s.segIndex === seedSegmentIndex);
    return info?.outline ?? outlinePoints;
  }, [mode, segmentsInfo, seedSegmentIndex, outlinePoints]);

  // seed segment's persisted cut lines (normalized to ITS own range)
  const seedNormalizedLines = useMemo(() => {
    if (mode !== "POLYLINE") return meshLines ?? [];
    if (seedSegmentIndex == null) return [];
    return meshLinesBySegment?.[seedSegmentIndex] ?? [];
  }, [mode, meshLines, meshLinesBySegment, seedSegmentIndex]);

  // lines shown for the seed segment: draft while editing, else persisted
  const persistedWorldLines = useMemo(
    () =>
      denormalizeMeshLines(seedNormalizedLines, {
        mode,
        imageSize,
        developedRange: seedSegmentRange,
        meterByPx,
      }),
    [seedNormalizedLines, mode, imageSize, seedSegmentRange, meterByPx]
  );
  const linesForDisplay = editing ? draftMeshLines : persistedWorldLines;

  // seed the draft from the persisted lines when entering edit mode. Editing is
  // triggered from the panel header (which can't compute developedRange for
  // POLYLINE), so the seed happens here where persistedWorldLines is available.
  // useLayoutEffect runs before paint → no one-frame flicker of empty lines.
  // Also re-seed when the user switches the seed segment WHILE editing, so the
  // draft reflects the newly-developed segment's own lines instead of carrying
  // the previous segment's draft over.
  const wasEditing = useRef(false);
  const prevSeedRef = useRef(seedSegmentIndex);
  useLayoutEffect(() => {
    const startedEditing = editing && !wasEditing.current;
    const seedChangedWhileEditing =
      editing && wasEditing.current && prevSeedRef.current !== seedSegmentIndex;
    if (startedEditing || seedChangedWhileEditing) {
      dispatch(setMeshLines(persistedWorldLines));
    }
    wasEditing.current = editing;
    prevSeedRef.current = seedSegmentIndex;
  }, [editing, seedSegmentIndex, persistedWorldLines, dispatch]);

  // continue the per-listing maille numbering (M1, M2, M3…) after the mailles of
  // surfaces created before this one
  const labelOffset = useMeshCellLabelOffset({
    listingId: annotation?.listingId,
    parentAnnotationId: annotationId,
    parentCreatedAt: annotation?.createdAt,
  });

  // cells of the SEED (editable / principal) segment — draft when editing, else
  // its persisted lines. Drives the editable display + the "Enregistrer" gate.
  const editableCells = useMeshCells({
    outlinePoints: seedOutline,
    meshLines: linesForDisplay,
    meterByPx,
    labelOffset,
  });

  // map each maille (by its M-label) to its persisted annotation, so clicking a
  // cell in the panel selects that maille on the map (which then highlights the
  // whole group — see MeshSelectionHighlight).
  const allAnnotations = useAnnotationsV2({ caller: "MeshEditor" });
  const mailleByLabel = useMemo(() => {
    const map = new Map();
    (allAnnotations ?? []).forEach((a) => {
      if (a.isMeshCell && a.parentAnnotationId === annotationId && a.label)
        map.set(a.label, a);
    });
    return map;
  }, [allAnnotations, annotationId]);

  // Persisted mailles of THIS surface for the current segment, in reading order
  // (meshCellIndex). Drives the labels shown outside edit mode so the panel
  // matches the persisted M-number (= the one the 3D sprite shows). POLYGON has
  // no segment → all of the parent's cells.
  const { rows: meshRels } = useMeshCellRelations();
  const seedByCellId = useMemo(() => {
    const m = new Map();
    (meshRels ?? []).forEach((r) =>
      m.set(r.meshCellAnnotationId, r.seedSegmentIndex)
    );
    return m;
  }, [meshRels]);
  // persisted mailles grouped by their segment (POLYLINE), each sorted by
  // reading order (meshCellIndex), so every chain segment shows its own labels.
  // POLYGON has no segment → a single group under POLYGON_KEY.
  const POLYGON_KEY = "POLYGON";
  const maillesBySeg = useMemo(() => {
    const m = new Map();
    (allAnnotations ?? []).forEach((a) => {
      if (!a.isMeshCell || a.parentAnnotationId !== annotationId) return;
      const key = mode === "POLYLINE" ? seedByCellId.get(a.id) : POLYGON_KEY;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(a);
    });
    for (const arr of m.values())
      arr.sort((a, b) => (a.meshCellIndex ?? 0) - (b.meshCellIndex ?? 0));
    return m;
  }, [allAnnotations, annotationId, mode, seedByCellId]);

  // Next free maille number across the listing — used to preview the number a
  // cell created mid-edit will receive (mirrors saveMeshService, which maxes
  // over ALL listing cells including the ones being re-meshed, both still in DB
  // here). labelNum() fallback covers legacy cells without meshCellNumber.
  const nextFreeNumber = useMemo(() => {
    const max = (allAnnotations ?? []).reduce((m, a) => {
      if (!a.isMeshCell || a.listingId !== annotation?.listingId) return m;
      return Math.max(m, a.meshCellNumber ?? labelNum(a.label) ?? 0);
    }, 0);
    return max + 1;
  }, [allAnnotations, annotation?.listingId]);

  // Overlay the persisted label onto each computed cell of a segment by
  // reading-order index (same mapping saveMeshService uses). New seed cells
  // (mid-edit) get the provisional next-free number. Only renamable outside
  // edit mode (cells created while editing don't exist as annotations yet).
  const buildSegCells = useCallback(
    (segCells, segKey, isSeed) => {
      const mailles = maillesBySeg.get(segKey) ?? [];
      return segCells.map((c, i) => {
        const m = mailles[i];
        return {
          ...c,
          id: `${segKey}:${c.id}`,
          label: m ? m.label : `M${nextFreeNumber + (i - mailles.length)}`,
          mailleId: !editing && m ? m.id : undefined,
          segIndex: segKey,
          editable: isSeed && editing,
        };
      });
    },
    [maillesBySeg, editing, nextFreeNumber]
  );

  // Combined cells across the visible chain: the SEED segment uses the editable
  // cells (draft/persisted); the others use their own persisted lines (read-only
  // context), each meshed in its own developed range. POLYGON → single group.
  const displayCells = useMemo(() => {
    if (mode !== "POLYLINE") {
      return buildSegCells(editableCells, POLYGON_KEY, true);
    }
    const out = [];
    for (const seg of segmentsInfo) {
      const isSeed = seg.segIndex === seedSegmentIndex;
      const segCells = isSeed
        ? editableCells
        : computeMeshCells(
            seg.outline,
            denormalizeMeshLines(meshLinesBySegment?.[seg.segIndex] ?? [], {
              mode: "POLYLINE",
              developedRange: seg.range,
              meterByPx,
            }),
            { meterByPx }
          );
      out.push(...buildSegCells(segCells, seg.segIndex, isSeed));
    }
    return out;
  }, [
    mode,
    segmentsInfo,
    seedSegmentIndex,
    editableCells,
    meshLinesBySegment,
    meterByPx,
    buildSegCells,
  ]);

  // inline rename of a maille label (double-click the label, view mode only)
  const [renamingMailleId, setRenamingMailleId] = useState(null);
  const handleStartRename = useCallback((cell) => {
    if (cell?.mailleId) setRenamingMailleId(cell.mailleId);
  }, []);
  const handleCommitRename = useCallback(
    (mailleId, label) => {
      setRenamingMailleId(null);
      renameMeshCellService({ mailleId, label, dispatch });
    },
    [dispatch]
  );
  const handleCancelRename = useCallback(() => setRenamingMailleId(null), []);
  useEffect(() => {
    if (editing) setRenamingMailleId(null);
  }, [editing]);

  const handleCellSelect = useCallback(
    (label) => {
      if (editing) return; // no selection changes while editing the mesh
      // re-click the already-selected maille → deselect it, falling back to the
      // parent surface so the Maillage panel stays open (segment preserved).
      if (label && label === selectedMailleLabel) {
        if (annotation) dispatch(setSelectedItem(annotationSelectionItem(annotation)));
        return;
      }
      const m = mailleByLabel.get(label);
      if (!m) return;
      dispatch(setSelectedItem(meshCellSelectionItem(m)));
    },
    [editing, selectedMailleLabel, annotation, mailleByLabel, dispatch]
  );

  // snap targets for the line tools: outline vertices + interior cut-line
  // endpoints + cut-line/outline-edge intersections, PLUS the vertices of the
  // read-only mailles on neighbouring segments, so a new cut can align with a
  // maille of an adjacent segment.
  const snapCandidates = useMemo(() => {
    const base = buildSnapCandidates({ outlinePoints, meshLines: draftMeshLines });
    const neighbours = [];
    displayCells.forEach((cell) => {
      if (cell.editable) return; // seed cells already covered via draftMeshLines
      (cell.points ?? []).forEach((p, i) =>
        neighbours.push({ id: `${cell.id}-v${i}`, x: p.x, y: p.y })
      );
    });
    return [...base, ...neighbours];
  }, [outlinePoints, draftMeshLines, displayCells]);

  // dragging a cut line snaps to the same targets
  const { startLineDrag } = useMeshLineDrag({
    viewportRef,
    snapCandidates,
    snapRadius: SNAP_PX / (zoom || 1),
  });

  const isPlacing =
    activeTool === "ADD_VERTICAL" ||
    activeTool === "ADD_HORIZONTAL" ||
    activeTool === "ADD_FREE" ||
    activeTool === "GRID";

  // clear transient drawing state when leaving a placing tool
  useEffect(() => {
    if (activeTool !== "ADD_FREE") setFree(null);
    if (!isPlacing) {
      setPreview(null);
      setSnapPoint(null);
    }
  }, [activeTool, isPlacing, setFree]);

  // snap a world position to a candidate (within SNAP_PX at the current zoom);
  // returns { pos, snap }. For the HORIZONTAL / VERTICAL tools the snap is
  // axis-aware — a horizontal cut aligns to the nearest candidate HEIGHT (y),
  // a vertical cut to the nearest candidate X — regardless of the distance
  // along the other axis, so cuts can line up with a neighbour segment's maille
  // vertex that sits off to the side. FREE / GRID keep nearest-point snapping.
  const snapWorld = useCallback(
    (worldPos) => {
      const radius = SNAP_PX / (zoom || 1);
      const axis =
        activeTool === "ADD_HORIZONTAL"
          ? "y"
          : activeTool === "ADD_VERTICAL"
            ? "x"
            : null;
      if (axis) {
        let best = null;
        let bestD = radius;
        for (const c of snapCandidates) {
          const d = Math.abs(c[axis] - worldPos[axis]);
          if (d <= bestD) {
            bestD = d;
            best = c;
          }
        }
        if (!best) return { pos: worldPos, snap: null };
        const pos =
          axis === "y"
            ? { x: worldPos.x, y: best.y }
            : { x: best.x, y: worldPos.y };
        return { pos, snap: { x: best.x, y: best.y } };
      }
      const snap = snapToCandidates(worldPos, snapCandidates, radius);
      return { pos: snap ? { x: snap.x, y: snap.y } : worldPos, snap };
    },
    [snapCandidates, zoom, activeTool]
  );

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

  const handleSave = useCallback(async () => {
    // Only the SEED segment is meshed: compute its cells on its own outline and
    // normalize the cut lines to its own developed range (so each segment's
    // mesh is stored independently of the visible chain).
    const computed = computeMeshCells(seedOutline, draftMeshLines, {
      meterByPx,
      labelOffset,
    });
    // remember the selected maille (it is about to be deleted & recreated)
    const prevLabel = selectedMailleLabel;
    const { createdCells } = await saveMeshService({
      parentAnnotation: annotation,
      mode,
      cells: computed,
      draftMeshLines,
      imageSize,
      meterByPx,
      elevation:
        mode === "POLYLINE"
          ? { chain, developedRange: seedSegmentRange, seedSegmentIndex }
          : undefined,
      dispatch,
    });
    dispatch(stopMeshEditing());
    // Keep the panel populated on the same maille/segment: re-select the new
    // cell that carries the previously-selected label (same stable number), or
    // fall back to the first created cell of this segment if that slot is gone.
    // When no maille was selected (the parent was), it survives the save → no-op.
    if (prevLabel && createdCells?.length) {
      const m =
        createdCells.find((c) => c.label === prevLabel) ?? createdCells[0];
      dispatch(setSelectedItem(meshCellSelectionItem(m)));
    }
  }, [
    seedOutline,
    draftMeshLines,
    meterByPx,
    labelOffset,
    annotation,
    mode,
    imageSize,
    chain,
    seedSegmentRange,
    seedSegmentIndex,
    selectedMailleLabel,
    dispatch,
  ]);

  // toggle a drawing tool (ToggleButtonGroup passes null when toggling off)
  const handleSelectTool = useCallback(
    (value) => {
      dispatch(setActiveTool(value ?? "SELECT"));
    },
    [dispatch]
  );

  // Build the cut lines of a grid of `gridCell` (m) cells, anchored so that one
  // line passes through `anchor`, repeating outward to the outline edges.
  const buildAnchoredGrid = useCallback(
    (anchor) => {
      if (!meterByPx) return [];
      const lines = [];
      const stepX = gridCell.width / meterByPx;
      const stepY = gridCell.height / meterByPx;
      if (stepX > 1) {
        let x0 = anchor.x;
        while (x0 > bbox.minX) x0 -= stepX;
        for (let x = x0; x < bbox.maxX && lines.length < 500; x += stepX) {
          if (x <= bbox.minX + 1e-6) continue;
          lines.push({
            id: nanoid(),
            orientation: "VERTICAL",
            ...lineForBbox("VERTICAL", x, bbox),
          });
        }
      }
      if (stepY > 1) {
        let y0 = anchor.y;
        while (y0 > bbox.minY) y0 -= stepY;
        for (let y = y0; y < bbox.maxY && lines.length < 1000; y += stepY) {
          if (y <= bbox.minY + 1e-6) continue;
          lines.push({
            id: nanoid(),
            orientation: "HORIZONTAL",
            ...lineForBbox("HORIZONTAL", y, bbox),
          });
        }
      }
      return lines;
    },
    [gridCell, meterByPx, bbox]
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
  // "Réinitialiser": delete ALL mailles of the selected segment (persisted),
  // drop its cut lines, then leave edit mode. The segment becomes un-meshed.
  // Re-select the parent so the panel stays open on the same surface/segment.
  const handleReset = useCallback(async () => {
    await deleteMeshSegmentService({
      parentAnnotation: annotation,
      mode,
      seedSegmentIndex,
      dispatch,
    });
    dispatch(setMeshLines([]));
    dispatch(stopMeshEditing());
    if (annotation) {
      dispatch(setSelectedItem(annotationSelectionItem(annotation)));
    }
  }, [annotation, mode, seedSegmentIndex, dispatch]);

  // live preview of the line being placed (follows the snapped cursor)
  const handleWorldMove = useCallback(
    ({ worldPos }) => {
      if (!isPlacing) return;
      const { pos, snap } = snapWorld(worldPos);
      setPreview(pos);
      setSnapPoint(snap ? { x: snap.x, y: snap.y } : null);
    },
    [isPlacing, snapWorld]
  );

  const handleWorldClick = useCallback(
    ({ worldPos }) => {
      const { pos } = snapWorld(worldPos);
      if (activeTool === "ADD_VERTICAL") {
        dispatch(
          addMeshLine({
            orientation: "VERTICAL",
            ...lineForBbox("VERTICAL", pos.x, bbox),
          })
        );
      } else if (activeTool === "ADD_HORIZONTAL") {
        dispatch(
          addMeshLine({
            orientation: "HORIZONTAL",
            ...lineForBbox("HORIZONTAL", pos.y, bbox),
          })
        );
      } else if (activeTool === "ADD_FREE") {
        // first click sets the start point; second click closes the line. Read
        // the start from the ref (the viewport calls this from a deferred window
        // listener, so a state closure could be stale).
        const start = freeStartRef.current;
        if (!start) {
          setFree(pos);
        } else if (Math.hypot(pos.x - start.x, pos.y - start.y) < 1e-3) {
          // ignore a degenerate second click on the same spot
        } else {
          dispatch(addMeshLine({ orientation: "FREE", p1: start, p2: pos }));
          setFree(null);
        }
      } else if (activeTool === "GRID") {
        const grid = buildAnchoredGrid(pos);
        if (grid.length) dispatch(setMeshLines(grid));
        dispatch(setActiveTool("SELECT"));
      } else {
        // SELECT: clicking the elevation picks the editable band (POLYLINE)
        if (mode === "POLYLINE" && vertices?.length >= 2) {
          const seg = pickSegmentAtX(worldPos.x, vertices);
          if (seg != null) dispatch(setEditedSegmentIndex(seg));
        }
        dispatch(setSelectedLineId(null));
      }
    },
    [activeTool, bbox, dispatch, mode, vertices, snapWorld, setFree, buildAnchoredGrid]
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

  // the temp bar the cursor drags while a line tool is active
  const previewLine = useMemo(() => {
    if (!preview) return null;
    if (activeTool === "ADD_VERTICAL")
      return lineForBbox("VERTICAL", preview.x, bbox);
    if (activeTool === "ADD_HORIZONTAL")
      return lineForBbox("HORIZONTAL", preview.y, bbox);
    if (activeTool === "ADD_FREE" && freeStart)
      return { p1: freeStart, p2: preview };
    return null;
  }, [preview, activeTool, bbox, freeStart]);

  // expose save / reset to the panel header (which hosts the action buttons)
  useImperativeHandle(ref, () => ({ save: handleSave, reset: handleReset }), [
    handleSave,
    handleReset,
  ]);

  // report whether the seed segment's draft yields cells → "Enregistrer" gate
  useEffect(() => {
    dispatch(setMeshCanSave((editableCells?.length ?? 0) > 0));
  }, [editableCells, dispatch]);

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
          onWorldMouseMove={handleWorldMove}
          onCameraChange={handleCameraChange}
        >
          {mode === "POLYLINE" && (
            <MeshElevationBackdrop
              vertices={vertices}
              editedSegmentIndex={editedSegmentIndex}
              hoveredSegmentIndex={hoveredSegmentIndex}
              color={color}
              zoom={zoom}
            />
          )}
          <MeshSvg
            color={color}
            meterByPx={meterByPx}
            outlinePoints={outlinePoints}
            bbox={bbox}
            cells={displayCells}
            meshLines={linesForDisplay}
            editing={editing}
            vertexDots={editing ? outlinePoints : null}
            previewLine={previewLine}
            snapPoint={snapPoint}
            selectedLineId={selectedLineId}
            hoveredLineId={hoveredLineId}
            onLineMouseDown={startLineDrag}
            onHoverLine={(id) => dispatch(setHoveredLineId(id))}
            onCommitLinePosition={handleCommitLinePosition}
            showOutline={mode !== "POLYLINE"}
            cellFill={mode !== "POLYLINE"}
            coteXRange={coteXRange}
            zoom={zoom}
            selectedCellLabel={selectedMailleLabel}
            hoveredCellLabel={hoveredCellLabel}
            onHoverCell={setHoveredCellLabel}
            onCellSelect={handleCellSelect}
            renamingMailleId={renamingMailleId}
            onStartRename={handleStartRename}
            onCommitRename={handleCommitRename}
            onCancelRename={handleCancelRename}
          />
        </MapEditorViewport>
      </Box>

      <MeshToolbar
        editing={editing}
        activeTool={activeTool}
        freeStartPlaced={Boolean(freeStart)}
        showMeshByEdges={mode === "POLYLINE"}
        gridCell={gridCell}
        onChangeGridCell={(patch) => dispatch(setMeshGridCell(patch))}
        onSelectTool={handleSelectTool}
        onMeshByEdges={handleMeshByEdges}
      />
    </Box>
  );
}

export default forwardRef(MeshEditor);
