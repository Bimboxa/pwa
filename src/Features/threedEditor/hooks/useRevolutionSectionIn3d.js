import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import { setRevolutionSectionSide } from "Features/threedEditor/threedEditorSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Half a wall thickness of hysteresis around each vertical base map plane so
// orbiting exactly on the plane doesn't flap the side (each flip rebuilds the
// 3D annotation objects).
const SIDE_HYSTERESIS_M = 0.05;

// Tracks which side of each VERTICAL base map plane the camera is on, and
// mirrors it to `state.threedEditor.revolutionSectionSideByBaseMapId`
// (1 = +normal / image-facing side, -1 = behind). Consumed by the REVOLUTION
// half-view (the revolution axis's "Demi-vue 3D" toggle): revolutions built
// from a profile on that base map render only the 180° half opposite the
// camera, so the image reads as a section plane. Always tracked — which base
// maps actually host a half-viewed revolution is decided downstream
// (useAutoLoadAnnotationsInThreedEditor), where unused sides are ignored.
//
// Dispatches ONLY on a side flip (rare — the camera crossing the plane).
// Mounted once from MainThreedEditor, same pattern as
// useApplyBaseMapVisibilityIn3d.
export default function useRevolutionSectionIn3d({ rendererIsReady } = {}) {
  const dispatch = useDispatch();
  const store = useStore();

  const { value: baseMaps = [] } = useBaseMaps();

  // Placement key: a moved/rotated vertical base map must recompute sides.
  const placementKey = baseMaps
    .filter((bm) => getBaseMapTransform(bm).orientation === "VERTICAL")
    .map((bm) => {
      const t = getBaseMapTransform(bm);
      return `${bm.id}:${t.angleDeg}:${t.position.x},${t.position.y},${t.position.z}`;
    })
    .join("|");

  useEffect(() => {
    const editor = getActiveThreedEditor();
    const camera = editor?.sceneManager?.camera;
    if (!camera) return;

    const trackedBaseMaps = baseMaps.filter(
      (bm) => getBaseMapTransform(bm).orientation === "VERTICAL"
    );
    if (trackedBaseMaps.length === 0) return;

    const computeSides = () => {
      const sides =
        store.getState().threedEditor.revolutionSectionSideByBaseMapId || {};
      trackedBaseMaps.forEach((bm) => {
        const t = getBaseMapTransform(bm);
        // VERTICAL base map world normal: local +Z rotated by angleDeg
        // around world Y (euler YXZ with x=0, z=0 — see getBaseMapEuler).
        const angleRad = (t.angleDeg * Math.PI) / 180;
        const nx = Math.sin(angleRad);
        const nz = Math.cos(angleRad);
        const d =
          nx * (camera.position.x - t.position.x) +
          nz * (camera.position.z - t.position.z);
        if (Math.abs(d) < SIDE_HYSTERESIS_M) return; // keep previous side
        const side = d >= 0 ? 1 : -1;
        if ((sides[bm.id] ?? 1) !== side) {
          dispatch(setRevolutionSectionSide({ baseMapId: bm.id, side }));
        }
      });
    };

    computeSides();
    // camera-controls "update" fires on every camera pose change; computeSides
    // is a few dot products and dispatches only on a plane crossing.
    const cameraControls =
      editor?.sceneManager?.controlsManager?.cameraControls;
    cameraControls?.addEventListener("update", computeSides);
    return () => {
      cameraControls?.removeEventListener("update", computeSides);
    };
  }, [rendererIsReady, placementKey, baseMaps]);
}
