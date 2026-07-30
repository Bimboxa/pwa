import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setRevolutionSectionSide } from "Features/threedEditor/threedEditorSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Half a wall thickness of hysteresis around each vertical base map plane so
// orbiting exactly on the plane doesn't flap the side (each flip rebuilds the
// 3D annotation objects).
const SIDE_HYSTERESIS_M = 0.05;

// Tracks which side of each displayed VERTICAL base map plane the camera is
// on, and mirrors it to `state.threedEditor.revolutionSectionSideByBaseMapId`
// (1 = +normal / image-facing side, -1 = behind). Consumed by the REVOLUTION
// half-view: when the vertical base map image is shown in 3D, revolutions
// built from a profile on that base map render only the 180° half opposite
// the camera, so the image reads as a section plane.
//
// Dispatches ONLY on a side flip (rare — the camera crossing the plane), and
// only for base maps whose image is currently displayed; hidden base maps
// keep their last side, which is harmless since the half-view is gated on
// image visibility downstream. Mounted once from MainThreedEditor, same
// pattern as useApplyBaseMapVisibilityIn3d.
export default function useRevolutionSectionIn3d({ rendererIsReady } = {}) {
  const dispatch = useDispatch();
  const store = useStore();

  const visibleIds = useSelector((s) => s.threedEditor.visibleBaseMapIdsIn3d);
  const hideBaseMaps = useSelector((s) => s.threedEditor.hideBaseMaps);
  const hideMainImage = useSelector(
    (s) => s.threedEditor.hideMainBaseMapImageIn3d
  );
  // "Révolution partielle" switch: the half-view stays active while the base
  // map image is hidden, so its camera side must keep being tracked too.
  const forceRevolutionSection = useSelector(
    (s) => s.threedEditor.forceRevolutionSectionIn3d
  );
  const mainBaseMap = useMainBaseMap();
  const { value: baseMaps = [] } = useBaseMaps();

  const visibleKey = (visibleIds || []).join(",");
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

    const mainId = mainBaseMap?.id ?? null;
    const visible = new Set(visibleIds || []);
    const trackedBaseMaps = baseMaps.filter((bm) => {
      const t = getBaseMapTransform(bm);
      if (t.orientation !== "VERTICAL") return false;
      if (forceRevolutionSection) return true;
      const eyeOn = bm.id === mainId ? !hideMainImage : visible.has(bm.id);
      return eyeOn && !hideBaseMaps;
    });
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
  }, [
    rendererIsReady,
    visibleKey,
    placementKey,
    hideBaseMaps,
    hideMainImage,
    forceRevolutionSection,
    mainBaseMap?.id,
    baseMaps,
  ]);
}
