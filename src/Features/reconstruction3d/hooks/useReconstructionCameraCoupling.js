import { useCallback, useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setReconstructionCoupled } from "../reconstruction3dSlice";
import { setCameraOrtho } from "Features/threedEditor/threedEditorSlice";

import applyReconstructionCameraPose, {
  getThreedEditorCanvas,
  getThreedPerspectiveFov,
  setThreedPerspectiveFov,
} from "../utils/applyReconstructionCameraPose";

// Coupling of the reconstruction player with the camera of the 3D editor
// (one way: the player drives the camera).
//
// `active`: the player is coupled AND the 3D editor is displayed. While
// active:
// - the returned `applyPose(pose)` jumps the 3D camera to a reconstruction
//   camera (glTF frame of the model, see applyReconstructionCameraPose),
//   `pullBackM` metres behind it along its line of sight;
// - the 3D view goes perspective (a camera position means nothing in
//   orthographic projection);
// - a gesture of the user on the 3D canvas (press, wheel) hands the camera
//   back: the coupling is switched off (reconstruction3d.coupled) — the
//   player keeps playing, its button couples again.
// When the coupling ends, the field of view the camera had before is
// restored (the cameras of a reconstruction carry their own).
export default function useReconstructionCameraCoupling({
  baseMapId,
  active,
  pullBackM = 0,
}) {
  const dispatch = useDispatch();

  // data

  const cameraOrtho = useSelector((s) => s.threedEditor.cameraOrtho);

  // state

  const activeRef = useRef(active);
  activeRef.current = active;
  const baseMapIdRef = useRef(baseMapId);
  baseMapIdRef.current = baseMapId;
  const pullBackRef = useRef(pullBackM);
  pullBackRef.current = pullBackM;

  // effects

  useEffect(() => {
    if (active && cameraOrtho) dispatch(setCameraOrtho(false));
  }, [active, cameraOrtho, dispatch]);

  useEffect(() => {
    if (!active) return undefined;
    const fovBefore = getThreedPerspectiveFov();
    const handleGesture = () => dispatch(setReconstructionCoupled(false));

    // The 3D editor may still be mounting when the player opens: look for
    // its canvas until it is there.
    let canvas = null;
    let timer = null;
    const attach = () => {
      canvas = getThreedEditorCanvas();
      if (!canvas) {
        timer = setTimeout(attach, 300);
        return;
      }
      // capture: the editor handles (and may stop) these events itself
      canvas.addEventListener("pointerdown", handleGesture, true);
      canvas.addEventListener("wheel", handleGesture, {
        capture: true,
        passive: true,
      });
    };
    attach();

    return () => {
      clearTimeout(timer);
      if (canvas) {
        canvas.removeEventListener("pointerdown", handleGesture, true);
        canvas.removeEventListener("wheel", handleGesture, { capture: true });
      }
      if (fovBefore != null) setThreedPerspectiveFov(fovBefore);
    };
  }, [active, dispatch]);

  // helpers

  // `pullBackOverrideM`: a value not rendered yet (slider being dragged)
  const applyPose = useCallback((pose, pullBackOverrideM) => {
    if (!activeRef.current || !pose) return false;
    return applyReconstructionCameraPose({
      baseMapId: baseMapIdRef.current,
      pose,
      pullBackM: pullBackOverrideM ?? pullBackRef.current,
    });
  }, []);

  return applyPose;
}
