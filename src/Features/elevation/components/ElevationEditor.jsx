import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useDispatch } from "react-redux";

import { Box, Typography } from "@mui/material";

import MapEditorViewport from "Features/mapEditorGeneric/components/MapEditorViewport";
import ElevationProfileSvg from "./ElevationProfileSvg";
import ElevationProfileSectionSvg from "./ElevationProfileSectionSvg";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useElevationProfile from "Features/elevation/hooks/useElevationProfile";
import useElevationPointDrag from "Features/elevation/hooks/useElevationPointDrag";
import useDeleteIsoHeightLine from "Features/annotations/hooks/useDeleteIsoHeightLine";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import buildProfileSectionGeometry from "Features/elevation/utils/buildProfileSectionGeometry";
import commitElevationOffsetService from "Features/elevation/services/commitElevationOffsetService";
import commitElevationOffsetsService from "Features/elevation/services/commitElevationOffsetsService";
import commitIsoHeightLineHeightService from "Features/elevation/services/commitIsoHeightLineHeightService";
import createIsoHeightLineService from "Features/elevation/services/createIsoHeightLineService";
import setAnnotationOffsetZService from "Features/elevation/services/setAnnotationOffsetZService";
import setAnnotationHeightService from "Features/elevation/services/setAnnotationHeightService";
import setElevationGuideService from "Features/elevation/services/setElevationGuideService";
import updateProfileVertexHeightService from "Features/elevation/services/updateProfileVertexHeightService";
import insertProfileVertexService from "Features/elevation/services/insertProfileVertexService";
import deleteProfileVertexService from "Features/elevation/services/deleteProfileVertexService";

// Picks the segment whose projected X-band contains `x` (smallest band wins on
// overlap from fold-backs); falls back to the nearest band. Returns the
// original segment index (the band owner's `segIndex`, which maps an arc's
// sampled sub-bands back to their parent segment) or null.
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

// Pan/zoom elevation editor. Reuses MapEditorViewport (SVG camera, same model
// as MainMapEditorV3). Segment hover/selection is hit-tested via the viewport's
// world callbacks (so panning keeps working); the profile SVG only renders the
// feedback.
export default function ElevationEditor({
  annotationId,
  points,
  selectedSegmentIndices,
  seedSegmentIndex,
  editedSegmentIndex,
  observationSign,
  meterByPx,
  height,
  offsetZ,
  color,
  isoLines = null,
  // POLYGON surface: top profile only (no quads/bottom/recap) — see
  // ElevationProfileSvg.
  surfaceMode = false,
  // Guide image config ({ baseMapId, x?, y? }) — a VERTICAL baseMap drawn
  // under the profile as a background guide for the isoHeight points.
  elevationGuide = null,
  // Shell profile section mode: resolved profileLines + the edited index
  // (null = silhouette / wall mode). When active, the editor shows ONE
  // profile's developed section (x = curvilinear distance) instead of the
  // projected silhouette.
  profileLines = [],
  editedProfileIndex = null,
  onSelectSegment,
}) {
  const viewportRef = useRef(null);
  const dispatch = useDispatch();

  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState(null);
  // live map zoom (read from the camera) → keeps the recap gap/margins constant
  // in screen pixels at any zoom level (see ElevationProfileSvg)
  const [zoom, setZoom] = useState(1);
  const handleCameraChange = useCallback((m) => {
    setZoom((z) => (z === m.k ? z : m.k));
  }, []);

  const handleCommitOffset = useCallback(
    (pointIndex, edge, value) => {
      commitElevationOffsetService({
        annotationId,
        pointIndex,
        edge,
        value,
        dispatch,
      });
    },
    [annotationId, dispatch]
  );

  const handleCommitOffsetZ = useCallback(
    (value) => {
      setAnnotationOffsetZService({ annotationId, offsetZ: value, dispatch });
    },
    [annotationId, dispatch]
  );

  const handleCommitHeight = useCallback(
    (value) => {
      setAnnotationHeightService({ annotationId, height: value, dispatch });
    },
    [annotationId, dispatch]
  );

  const handleCommitIsoHeight = useCallback(
    (index, value) => {
      commitIsoHeightLineHeightService({
        annotationId,
        index,
        height: value,
        dispatch,
      });
    },
    [annotationId, dispatch]
  );

  // Extremity field: same batch write as the extremity handle drag.
  const handleCommitExtremityOffset = useCallback(
    (pointIndexes, value) => {
      commitElevationOffsetsService({
        annotationId,
        pointIndexes,
        edge: "TOP",
        value,
        dispatch,
      });
    },
    [annotationId, dispatch]
  );

  // data

  const { vertices, bbox: profileBbox, isoMarkers, basis } = useElevationProfile({
    points,
    selectedSegmentIndices,
    seedSegmentIndex,
    observationSign,
    meterByPx,
    height,
    offsetZ,
    isoLines,
  });

  // Shell profile section (x = curvilinear distance along the profile).
  const sectionProfile =
    editedProfileIndex != null ? profileLines?.[editedProfileIndex] : null;
  const sectionGeometry = useMemo(
    () =>
      sectionProfile
        ? buildProfileSectionGeometry({
            profilePoints: sectionProfile.points,
            meterByPx,
            height,
            offsetZ,
          })
        : null,
    [sectionProfile, meterByPx, height, offsetZ]
  );
  const profileSectionMode = !!sectionGeometry;
  const bbox = profileSectionMode ? sectionGeometry.bbox : profileBbox;

  // --- guide image (background elevation drawing) ---

  const { value: baseMaps = [] } = useBaseMaps({});
  const [guideSelected, setGuideSelected] = useState(false);
  // live position override during a drag ({ x, y } in world coords)
  const [guidePos, setGuidePos] = useState(null);
  const guideDragRef = useRef(null);

  // Reset the local selection/drag state when the guide changes.
  useEffect(() => {
    setGuideSelected(false);
    setGuidePos(null);
  }, [elevationGuide?.baseMapId, annotationId]);

  const guideImage = useMemo(() => {
    const baseMapId = elevationGuide?.baseMapId;
    if (!baseMapId) return null;
    const bm = baseMaps.find((b) => b?.id === baseMapId);
    if (!bm) return null;
    // baseMaps records can be plain objects or instances — read via getters
    // with plain-field fallbacks.
    const url = bm.getUrl?.() ?? bm.imageUrl ?? bm.image?.imageUrl;
    const size = bm.getImageSize?.() ?? bm.image?.imageSize;
    if (!url || !size?.width || !size?.height) return null;
    // Scale the elevation image so its meters match the profile's vertical
    // meters (profile world px = plan-baseMap px).
    const elevMeterByPx = bm.getMeterByPx?.() ?? bm.meterByPx ?? null;
    const k = elevMeterByPx && meterByPx ? elevMeterByPx / meterByPx : 1;
    const width = size.width * k;
    const height = size.height * k;
    // Default placement: bottom-left corner on the Z = 0 line, at the left of
    // the profile.
    const x = elevationGuide?.x ?? (bbox ? bbox.minX : 0);
    const y = elevationGuide?.y ?? -height;
    return { url, width, height, x, y };
  }, [elevationGuide, baseMaps, meterByPx, bbox]);

  const guideX = guidePos?.x ?? guideImage?.x ?? 0;
  const guideY = guidePos?.y ?? guideImage?.y ?? 0;

  const handleGuideMove = useCallback(
    (e) => {
      const drag = guideDragRef.current;
      if (!drag || !viewportRef.current) return;
      const world = viewportRef.current.screenToWorld(e.clientX, e.clientY);
      const dx = world.x - drag.startWorld.x;
      const dy = world.y - drag.startWorld.y;
      if (Math.hypot(dx, dy) > 0.5) drag.moved = true;
      setGuidePos({ x: drag.origin.x + dx, y: drag.origin.y + dy });
    },
    [viewportRef]
  );

  const handleGuideUp = useCallback(
    (e) => {
      window.removeEventListener("mousemove", handleGuideMove);
      window.removeEventListener("mouseup", handleGuideUp);
      const drag = guideDragRef.current;
      guideDragRef.current = null;
      if (!drag || !viewportRef.current) return;
      if (!drag.moved) return; // plain click → handled by onClick (toggle)
      const world = viewportRef.current.screenToWorld(e.clientX, e.clientY);
      const x = drag.origin.x + (world.x - drag.startWorld.x);
      const y = drag.origin.y + (world.y - drag.startWorld.y);
      drag.committed = true;
      setElevationGuideService({
        annotationId,
        guide: { ...elevationGuide, x, y },
        dispatch,
      });
    },
    [handleGuideMove, viewportRef, annotationId, elevationGuide, dispatch]
  );

  // Screen position of the mousedown on the image — used by the click handler
  // to tell a real click from a pan that started on the image (the browser
  // still fires a click on mouse up after a pan).
  const guideDownPosRef = useRef(null);

  const handleGuideMouseDown = useCallback(
    (e) => {
      guideDownPosRef.current = { x: e.clientX, y: e.clientY };
      if (!guideSelected || !viewportRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      guideDragRef.current = {
        startWorld: viewportRef.current.screenToWorld(e.clientX, e.clientY),
        origin: { x: guideX, y: guideY },
        moved: false,
      };
      window.addEventListener("mousemove", handleGuideMove);
      window.addEventListener("mouseup", handleGuideUp);
    },
    [guideSelected, viewportRef, guideX, guideY, handleGuideMove, handleGuideUp]
  );

  const guideJustDraggedRef = useRef(false);
  const handleGuideClick = useCallback((e) => {
    e.stopPropagation();
    if (guideJustDraggedRef.current) {
      guideJustDraggedRef.current = false;
      return;
    }
    // Pan started on the image: the cursor moved between mousedown and the
    // click event → not a selection click.
    const down = guideDownPosRef.current;
    guideDownPosRef.current = null;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3) {
      return;
    }
    setGuideSelected((s) => !s);
  }, []);

  // Flag the click that follows a real drag so it doesn't toggle selection.
  useEffect(() => {
    const markDrag = () => {
      if (guideDragRef.current?.moved) guideJustDraggedRef.current = true;
    };
    window.addEventListener("mouseup", markDrag, true);
    return () => window.removeEventListener("mouseup", markDrag, true);
  }, []);

  const {
    startHandleDrag,
    startIsoHandleDrag,
    startExtremityDrag,
    startProfileVertexDrag,
    dragPreview,
  } = useElevationPointDrag({
    viewportRef,
    meterByPx,
    height,
    offsetZ,
    annotationId,
    basis,
  });

  // --- shell profile section mode: vertex selection / edit / insert ---

  const [selectedProfileVertexIndex, setSelectedProfileVertexIndex] =
    useState(null);

  useEffect(() => {
    setSelectedProfileVertexIndex(null);
  }, [annotationId, editedProfileIndex]);

  // Free 2-axis drag: Y = height, X = slide along the profile path in plan.
  // The s → plan mapping walks the CURRENT resolved polyline (so the vertex
  // slides along the drawn path, through its own previous position); the
  // slide is clamped strictly between the neighbor vertices.
  const handleProfileVertexMouseDown = useCallback(
    (e, { vertexIndex }) => {
      const pts = (sectionProfile?.points ?? []).filter(
        (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      );
      if (pts.length < 2 || vertexIndex <= 0 || vertexIndex >= pts.length - 1) {
        return;
      }
      const cum = [0];
      for (let i = 1; i < pts.length; i += 1) {
        cum.push(
          cum[i - 1] +
            Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
        );
      }
      const planAt = (s) => {
        for (let i = 0; i < pts.length - 1; i += 1) {
          if (s <= cum[i + 1] || i === pts.length - 2) {
            const span = Math.max(cum[i + 1] - cum[i], 1e-9);
            const t = Math.max(0, Math.min(1, (s - cum[i]) / span));
            return {
              x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
              y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
            };
          }
        }
        return { x: pts[0].x, y: pts[0].y };
      };
      // Keep a small margin so the vertex never lands ON a neighbor
      // (degenerate segment).
      const margin =
        Math.max(cum[vertexIndex + 1] - cum[vertexIndex - 1], 1e-6) * 0.02;
      startProfileVertexDrag(e, {
        profileIndex: editedProfileIndex,
        vertexIndex,
        sMin: cum[vertexIndex - 1] + margin,
        sMax: cum[vertexIndex + 1] - margin,
        planAt,
      });
    },
    [startProfileVertexDrag, editedProfileIndex, sectionProfile]
  );

  const handleCommitProfileVertexHeight = useCallback(
    (vertexIndex, value) => {
      updateProfileVertexHeightService({
        annotationId,
        profileIndex: editedProfileIndex,
        vertexIndex,
        height: value,
        dispatch,
      });
    },
    [annotationId, editedProfileIndex, dispatch]
  );

  const handleInsertProfileVertex = useCallback(
    ({ segIndex, t, height: vertexHeight }) => {
      insertProfileVertexService({
        annotationId,
        profileIndex: editedProfileIndex,
        segIndex,
        t,
        height: vertexHeight,
        dispatch,
      });
    },
    [annotationId, editedProfileIndex, dispatch]
  );

  // Delete/Backspace removes the selected profile vertex (interior only).
  // Capture phase + stopPropagation, like the iso-line delete above.
  useEffect(() => {
    if (!profileSectionMode || selectedProfileVertexIndex == null) return;
    const onKey = async (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      e.stopPropagation();
      await deleteProfileVertexService({
        annotationId,
        profileIndex: editedProfileIndex,
        vertexIndex: selectedProfileVertexIndex,
        dispatch,
      });
      setSelectedProfileVertexIndex(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    profileSectionMode,
    selectedProfileVertexIndex,
    annotationId,
    editedProfileIndex,
    dispatch,
  ]);

  // --- iso point selection (click a diamond → select; Delete removes) ---

  const [selectedIsoIndex, setSelectedIsoIndex] = useState(null);
  const deleteIsoHeightLine = useDeleteIsoHeightLine();

  useEffect(() => {
    setSelectedIsoIndex(null);
  }, [annotationId]);

  // Delete/Backspace removes the selected iso line. Capture phase +
  // stopPropagation so the map editor's window-level Delete handler (which
  // would open the delete-annotation dialog) never sees the event.
  useEffect(() => {
    if (selectedIsoIndex == null) return;
    const onKey = async (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      e.stopPropagation();
      await deleteIsoHeightLine({ annotationId, index: selectedIsoIndex });
      setSelectedIsoIndex(null);
      dispatch(triggerAnnotationsUpdate());
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selectedIsoIndex, annotationId, deleteIsoHeightLine, dispatch]);

  // --- add-point snap helper (surface mode) ---

  const [hoverWorldPos, setHoverWorldPos] = useState(null);

  // Creates a new iso line at the clicked profile position: the PLAN chord is
  // the section of the ring at that x (line perpendicular to the projection
  // axis), its height comes from the clicked y.
  const handleAddIsoPoint = useCallback(
    (profileX, worldY) => {
      if (!basis || !points?.length) return;
      const { originX, originY, ux, uy, sign, minRawX } = basis;
      const c = sign * (profileX + minRawX);
      const nx = -uy;
      const ny = ux;
      const ring = expandArcsInPath(points, 16, true).filter(
        (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      );
      if (ring.length < 3) return;
      const hits = [];
      for (let i = 0; i < ring.length; i++) {
        const A = ring[i];
        const B = ring[(i + 1) % ring.length];
        const da = (A.x - originX) * ux + (A.y - originY) * uy;
        const db = (B.x - originX) * ux + (B.y - originY) * uy;
        const denom = db - da;
        if (Math.abs(denom) < 1e-9) continue;
        const s = (c - da) / denom;
        if (s < 0 || s >= 1) continue;
        const P = { x: A.x + (B.x - A.x) * s, y: A.y + (B.y - A.y) * s };
        hits.push({ P, t: (P.x - originX) * nx + (P.y - originY) * ny });
      }
      if (hits.length < 2) return;
      hits.sort((a, b) => a.t - b.t);
      const first = hits[0].P;
      const last = hits[hits.length - 1].P;
      createIsoHeightLineService({
        annotationId,
        planPoints: [first, last],
        height: -worldY * meterByPx - height - offsetZ,
        dispatch,
      });
    },
    [basis, points, annotationId, meterByPx, height, offsetZ, dispatch]
  );

  // handlers - hover / select segment bands via the viewport

  // Surface mode has no per-segment bands: heights are edited through the
  // iso-line helpers; the mouse position feeds the add-point snap helper.
  const handleWorldMouseMove = useCallback(
    ({ worldPos, isPanning }) => {
      if (isPanning) {
        if (surfaceMode || profileSectionMode) setHoverWorldPos(null);
        return;
      }
      if (surfaceMode || profileSectionMode) {
        setHoverWorldPos(worldPos);
        return;
      }
      const seg = pickSegmentAtX(worldPos.x, vertices);
      setHoveredSegmentIndex((prev) => (prev === seg ? prev : seg));
    },
    [vertices, surfaceMode, profileSectionMode]
  );

  const handleWorldClick = useCallback(
    ({ worldPos }) => {
      // Clicking outside the guide image / iso points deselects them (their
      // own clicks are stopped before reaching the viewport).
      setGuideSelected(false);
      setSelectedIsoIndex(null);
      setSelectedProfileVertexIndex(null);
      if (surfaceMode || profileSectionMode) return;
      const seg = pickSegmentAtX(worldPos.x, vertices);
      if (seg != null) onSelectSegment?.(seg);
    },
    [vertices, onSelectSegment, surfaceMode, profileSectionMode]
  );

  // helper - fit-contain camera (refit when the projection/seed changes, so the
  // selected segment is laid out horizontal; not on every edit)

  const fitKey = `${annotationId}:${seedSegmentIndex}:${observationSign}:${
    editedProfileIndex ?? "-"
  }:${(selectedSegmentIndices ?? []).join(",")}`;

  useEffect(() => {
    if (!bbox || !viewportRef.current) return;

    let raf;
    const fit = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      const { width: vw, height: vh } = vp.getViewportSize();
      if (!vw || !vh) {
        raf = requestAnimationFrame(fit);
        return;
      }
      // Margins are proportional to the developed width (meterByPx-independent)
      // so the framing stays equally aerated whatever the map scale. The recap
      // gap/margins themselves are now screen-fixed (see ElevationProfileSvg);
      // this upward headroom is a generous allowance that comfortably contains
      // them at the fitted zoom.
      const profileW = Math.max(bbox.maxX - bbox.minX, 1);
      // Surface / profile-section modes have no "vue de dessus" recap above
      // the profile — a small headroom is enough.
      const fitMinY =
        bbox.minY -
        profileW * (surfaceMode || profileSectionMode ? 0.15 : 0.8) -
        16;
      // down to the baseMap reference plane (worldY = 0)
      const fitMaxY = Math.max(bbox.maxY, 0) + profileW * 0.12 + 16;
      // extra left margin to keep the Offset field (left of the baseMap line)
      // in view
      const fitMinX = bbox.minX - profileW * 0.22 - 40;
      const fitMaxX = bbox.maxX + profileW * 0.05 + 10;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // helpers

  const shouldDisablePan = (e) =>
    Boolean(e.target?.dataset?.elevHandle) ||
    (guideSelected && Boolean(e.target?.dataset?.elevGuide));

  // render

  if (!profileSectionMode && (!vertices || vertices.length < 2)) {
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
          Sélectionnez un segment dans l'aperçu pour voir son élévation.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, minHeight: 0, position: "relative" }}>
      <MapEditorViewport
        ref={viewportRef}
        shouldDisablePan={shouldDisablePan}
        onWorldMouseMove={handleWorldMouseMove}
        onWorldClick={handleWorldClick}
        onCameraChange={handleCameraChange}
      >
        {/* Guide image (elevation drawing) under the profile. Click toggles
            selection; when selected it can be dragged to reposition. */}
        {guideImage && (
          <g>
            <image
              href={guideImage.url}
              x={guideX}
              y={guideY}
              width={guideImage.width}
              height={guideImage.height}
              opacity={0.85}
              preserveAspectRatio="none"
              data-elev-guide="1"
              style={{ cursor: guideSelected ? "move" : "pointer" }}
              onMouseDown={handleGuideMouseDown}
              onClick={handleGuideClick}
            />
            {guideSelected && (
              <rect
                x={guideX}
                y={guideY}
                width={guideImage.width}
                height={guideImage.height}
                fill="none"
                stroke="#2196f3"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: "none" }}
              />
            )}
          </g>
        )}
        {profileSectionMode && (
          <ElevationProfileSectionSvg
            vertices={sectionGeometry.vertices}
            meterByPx={meterByPx}
            height={height}
            offsetZ={offsetZ}
            zoom={zoom}
            dragPreview={dragPreview}
            selectedVertexIndex={selectedProfileVertexIndex}
            onVertexMouseDown={handleProfileVertexMouseDown}
            onSelectVertex={setSelectedProfileVertexIndex}
            onCommitVertexHeight={handleCommitProfileVertexHeight}
            onCommitOffsetZ={handleCommitOffsetZ}
            hoverWorldPos={hoverWorldPos}
            onInsertVertex={handleInsertProfileVertex}
          />
        )}
        {!profileSectionMode && (
        <ElevationProfileSvg
          vertices={vertices}
          editedSegmentIndex={editedSegmentIndex}
          hoveredSegmentIndex={hoveredSegmentIndex}
          height={height}
          meterByPx={meterByPx}
          offsetZ={offsetZ}
          color={color}
          zoom={zoom}
          dragPreview={dragPreview}
          onHandleMouseDown={startHandleDrag}
          onCommitOffset={handleCommitOffset}
          onCommitOffsetZ={handleCommitOffsetZ}
          onCommitHeight={handleCommitHeight}
          isoMarkers={isoMarkers}
          onIsoHandleMouseDown={startIsoHandleDrag}
          onCommitIsoHeight={handleCommitIsoHeight}
          selectedIsoIndex={selectedIsoIndex}
          onSelectIso={setSelectedIsoIndex}
          onExtremityMouseDown={startExtremityDrag}
          onCommitExtremityOffset={handleCommitExtremityOffset}
          hoverWorldPos={hoverWorldPos}
          onAddIsoPoint={handleAddIsoPoint}
          surfaceMode={surfaceMode}
        />
        )}
      </MapEditorViewport>
    </Box>
  );
}
