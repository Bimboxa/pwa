import { useMemo, useRef } from "react";

import { getImageAnchorPoint } from "Features/imageAnnotations/utils/imageConnector";
import { subscribeMapEditorCamera } from "Features/mapEditor/services/mapEditorRegistry";

// ---------------------------------------------------------------------------
// useMapEditor2dAnchorProjector — anchor projector of the 2D map editor for
// ImagesLinksOverlay / CaptureImagesOverlay:
//   project(annotation) → the anchor (targetPoint, base-map px as resolved by
//   useAnnotationsV2) in CLIENT px, or null. Inverse of `toImage` in
//   useImageModeLabelsLayout: client = viewport.left + cam.x + cam.k *
//   (pose.x + pose.k * px).
//   getViewportRect() → client rect of the SVG viewport.
//   subscribe(listener) → camera-change bus of the active editor
//   (mapEditorRegistry), notified on every pan / zoom.
// ---------------------------------------------------------------------------

export default function useMapEditor2dAnchorProjector({
  interactionLayerRef,
  basePose,
}) {
  const poseRef = useRef(basePose);
  poseRef.current = basePose;

  return useMemo(
    () => ({
      project(annotation) {
        const layer = interactionLayerRef?.current;
        const cam = layer?.getCameraMatrix?.();
        const rect = layer?.getViewportRect?.();
        const pose = poseRef.current;
        if (!cam || !rect || !pose) return null;
        const p = getImageAnchorPoint(annotation);
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
        const k = cam.k || 1;
        const pk = pose.k ?? 1;
        return {
          x: rect.left + cam.x + k * ((pose.x ?? 0) + pk * p.x),
          y: rect.top + cam.y + k * ((pose.y ?? 0) + pk * p.y),
        };
      },
      getViewportRect() {
        return interactionLayerRef?.current?.getViewportRect?.() ?? null;
      },
      subscribe: subscribeMapEditorCamera,
    }),
    [interactionLayerRef]
  );
}
