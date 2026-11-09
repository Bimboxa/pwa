import { useMemo } from "react";
import { Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { getImageAnchorObjectsById } from "Features/threedAnnotationLabels/services/annotationLabelObjectsStore";

// ---------------------------------------------------------------------------
// useThreedImageAnchorProjector — anchor projector of the 3D viewer (same
// contract as useMapEditor2dAnchorProjector): the anchor of an IMAGE
// annotation is the anchor-dot sprite published by ThreedAnnotationLabels
// (annotationLabelObjectsStore.imageAnchorsById); its world position is
// projected with the scene camera into CLIENT px of the WebGL canvas.
// `subscribe` follows the camera through SceneManager.addRenderListener
// (fired after every renderScene, like AxesGizmoThreed).
// ---------------------------------------------------------------------------

const _v = new Vector3();

export default function useThreedImageAnchorProjector() {
  return useMemo(
    () => ({
      project(annotation) {
        const sceneManager = getActiveThreedEditor()?.sceneManager;
        const camera = sceneManager?.camera;
        const dom = sceneManager?.renderer?.domElement;
        const anchor = getImageAnchorObjectsById()[annotation?.id];
        if (!camera || !dom || !anchor) return null;
        const rect = dom.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const p = anchor.getWorldPosition(_v).project(camera);
        // Behind the camera / outside the depth range.
        if (!Number.isFinite(p.z) || p.z < -1 || p.z > 1) return null;
        return {
          x: rect.left + ((p.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - p.y) / 2) * rect.height,
        };
      },
      getViewportRect() {
        const dom = getActiveThreedEditor()?.sceneManager?.renderer?.domElement;
        return dom?.getBoundingClientRect?.() ?? null;
      },
      subscribe(listener) {
        const sceneManager = getActiveThreedEditor()?.sceneManager;
        if (!sceneManager?.addRenderListener) return () => {};
        sceneManager.addRenderListener(listener);
        return () => sceneManager.removeRenderListener?.(listener);
      },
    }),
    []
  );
}
