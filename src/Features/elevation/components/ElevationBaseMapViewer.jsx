import { useRef, useEffect, useCallback, useMemo } from "react";

import { Box, Typography } from "@mui/material";

import MapEditorViewport from "Features/mapEditorGeneric/components/MapEditorViewport";
import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import { TargetPair } from "Features/mapEditor/components/CalibrationLayer";
import {
  setDragCursor,
  clearDragCursor,
} from "Features/mapEditor/utils/dragCursor";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

// Read-only (but clickable) viewer of ONE baseMap + its annotations, rendered
// with the same canonical building blocks as MainMapEditorV3 (MapEditorViewport
// camera + NodeAnnotationStatic), like PrintableMap. The camera is fully local,
// so this never disturbs the main editor's global state. Selection IS shared on
// purpose (handled by the parent via onSelect* callbacks).
//
// World space = baseMap image pixels (annotations come back from useAnnotationsV2
// already resolved to pixel space).
//
// Optional `targets` ({red, green} relative [0..1] positions) draws the very
// same calibration targets as the main 2D editor, draggable, and reports every
// move through `onTargetsChange`.
export default function ElevationBaseMapViewer({
  baseMapId,
  selectedAxisId,
  highlightAnnotationId,
  targets,
  onSelectAxis,
  onSelectAnnotation,
  onTargetsChange,
}) {
  const viewportRef = useRef(null);

  // data

  const baseMap = useBaseMap({ id: baseMapId });

  const rawAnnotations = useAnnotationsV2({
    enabled: Boolean(baseMapId),
    filterByBaseMapId: baseMapId,
    withEntity: true,
    withQties: true,
    sortByOrderIndex: true,
    // Drop the baseMap's own annotations (title-block / cartouche items in
    // isForBaseMaps listings, and isBaseMapAnnotation labels) — same as the main
    // MAP viewer. Revolution axes are exempt from these filters, so they stay.
    hideBaseMapAnnotations: true,
    excludeIsForBaseMapsListings: true,
  });

  // The elevation viewer shows geometry (wall profiles, revolution axes) — not
  // the baseMap's text/cartouche fields (the orange "Texte" boxes). Drop TEXT /
  // LABEL annotations so only the meaningful geometry remains.
  const annotations = useMemo(
    () =>
      (rawAnnotations ?? []).filter(
        (a) => a.type !== "TEXT" && a.type !== "LABEL"
      ),
    [rawAnnotations]
  );

  const imageUrl = baseMap?.getUrl?.();
  const imageSize = baseMap?.getImageSize?.();
  const meterByPx = baseMap?.getMeterByPx?.();

  const annotationsById = useMemo(() => {
    const map = {};
    for (const a of annotations ?? []) map[a.id] = a;
    return map;
  }, [annotations]);

  // handlers - click hit-test (DOM data-node-id, same mechanism as the main
  // editor's InteractionLayer)

  const handleWorldClick = useCallback(
    ({ event }) => {
      const hit = event?.target?.closest?.("[data-node-id]");
      const nodeId = hit?.getAttribute?.("data-node-id");
      const annotation = nodeId ? annotationsById[nodeId] : null;
      if (!annotation) {
        onSelectAxis?.(null);
        return;
      }
      if (annotation.type === "REVOLUTION_AXIS") {
        onSelectAxis?.(annotation.id);
      } else {
        onSelectAnnotation?.(annotation);
      }
    },
    [annotationsById, onSelectAxis, onSelectAnnotation]
  );

  // handlers - calibration target drag (world = image pixels, so the relative
  // position is just world / imageSize — no clamping, same as
  // useCalibrationDrag in the main editor).

  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const onTargetsChangeRef = useRef(onTargetsChange);
  onTargetsChangeRef.current = onTargetsChange;
  const imageSizeRef = useRef(imageSize);
  imageSizeRef.current = imageSize;

  const handleTargetMouseDown = useCallback((e) => {
    const handle = e.target?.closest?.(
      '[data-interaction="calibration-target"]'
    );
    const color = handle?.getAttribute?.("data-target-color");
    if (!color) return;

    e.stopPropagation();

    const move = (ev) => {
      const world = viewportRef.current?.screenToWorld(ev.clientX, ev.clientY);
      const size = imageSizeRef.current;
      if (!world || !size?.width || !size?.height) return;
      onTargetsChangeRef.current?.({
        ...targetsRef.current,
        [color]: { x: world.x / size.width, y: world.y / size.height },
      });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      clearDragCursor();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    setDragCursor("crosshair");
  }, []);

  const shouldDisablePan = useCallback(
    (e) =>
      Boolean(e.target?.closest?.('[data-interaction="calibration-target"]')),
    []
  );

  // helper - fit-contain the image on baseMap change

  useEffect(() => {
    if (!imageSize?.width || !imageSize?.height || !viewportRef.current) return;
    let raf;
    const fit = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      const { width: vw, height: vh } = vp.getViewportSize();
      if (!vw || !vh) {
        raf = requestAnimationFrame(fit);
        return;
      }
      const pad = 16;
      const k =
        Math.min(
          (vw - pad * 2) / imageSize.width,
          (vh - pad * 2) / imageSize.height
        ) || 1;
      const cx = imageSize.width / 2;
      const cy = imageSize.height / 2;
      vp.setCameraMatrix({ x: vw / 2 - cx * k, y: vh / 2 - cy * k, k });
    };
    fit();
    return () => raf && cancelAnimationFrame(raf);
  }, [baseMapId, imageSize?.width, imageSize?.height]);

  // render

  if (!baseMapId) {
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
          Sélectionnez une élévation pour afficher ses annotations.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, minHeight: 0, position: "relative" }}>
      <MapEditorViewport
        ref={viewportRef}
        onWorldClick={handleWorldClick}
        shouldDisablePan={shouldDisablePan}
      >
        <g onMouseDown={handleTargetMouseDown}>
          {imageUrl && imageSize && (
            <NodeSvgImage
              src={imageUrl}
              width={imageSize.width}
              height={imageSize.height}
            />
          )}
          {(annotations ?? []).map((annotation) => {
            const isSelected =
              annotation.id === selectedAxisId ||
              annotation.id === highlightAnnotationId;
            return (
              <NodeAnnotationStatic
                key={annotation.id}
                annotation={annotation}
                selected={isSelected}
                baseMapMeterByPx={meterByPx}
                // The camera group already injects --map-zoom, and there is no
                // extra content scale here (world = image pixels), so containerK
                // must be 1 — otherwise the vertex handles / strokes double-count
                // the zoom. Mirrors NodePolylineStatic's screen-fixed sizing.
                containerK={1}
              />
            );
          })}

          {targets && imageSize && (
            <TargetPair
              targets={targets}
              width={imageSize.width}
              height={imageSize.height}
              // World = image pixels here (no extra content scale), like
              // NodeAnnotationStatic above.
              containerK={1}
              versionId={null}
              opacity={1}
              visible={{ red: true, green: true }}
            />
          )}
        </g>
      </MapEditorViewport>
    </Box>
  );
}
