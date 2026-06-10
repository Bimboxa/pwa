import { useRef, useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";

import { Box, Typography } from "@mui/material";

import MapEditorViewport from "Features/mapEditorGeneric/components/MapEditorViewport";
import ElevationProfileSvg from "./ElevationProfileSvg";

import useElevationProfile from "Features/elevation/hooks/useElevationProfile";
import useElevationPointDrag from "Features/elevation/hooks/useElevationPointDrag";
import commitElevationOffsetService from "Features/elevation/services/commitElevationOffsetService";
import setAnnotationOffsetZService from "Features/elevation/services/setAnnotationOffsetZService";
import setAnnotationHeightService from "Features/elevation/services/setAnnotationHeightService";

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

  // data

  const { vertices, bbox } = useElevationProfile({
    points,
    selectedSegmentIndices,
    seedSegmentIndex,
    observationSign,
    meterByPx,
    height,
    offsetZ,
  });

  const { startHandleDrag, dragPreview } = useElevationPointDrag({
    viewportRef,
    meterByPx,
    height,
    offsetZ,
    annotationId,
  });

  // handlers - hover / select segment bands via the viewport

  const handleWorldMouseMove = useCallback(
    ({ worldPos, isPanning }) => {
      if (isPanning) return;
      const seg = pickSegmentAtX(worldPos.x, vertices);
      setHoveredSegmentIndex((prev) => (prev === seg ? prev : seg));
    },
    [vertices]
  );

  const handleWorldClick = useCallback(
    ({ worldPos }) => {
      const seg = pickSegmentAtX(worldPos.x, vertices);
      if (seg != null) onSelectSegment?.(seg);
    },
    [vertices, onSelectSegment]
  );

  // helper - fit-contain camera (refit when the projection/seed changes, so the
  // selected segment is laid out horizontal; not on every edit)

  const fitKey = `${annotationId}:${seedSegmentIndex}:${observationSign}:${(
    selectedSegmentIndices ?? []
  ).join(",")}`;

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
      const fitMinY = bbox.minY - profileW * 0.8 - 16;
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

  const shouldDisablePan = (e) => Boolean(e.target?.dataset?.elevHandle);

  // render

  if (!vertices || vertices.length < 2) {
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
        />
      </MapEditorViewport>
    </Box>
  );
}
