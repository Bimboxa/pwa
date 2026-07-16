import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";
import { Vector3 } from "three";

import { setWalkModeActive } from "Features/threedEditor/threedEditorSlice";

import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { emitShoot } from "Features/threedMesh/services/shootAimStore";
import {
  pickWorldTargetAtNdc,
  getMuzzleOrigin,
} from "Features/threedMesh/services/shootPick";
import { createShootSprayController } from "Features/threedMesh/services/shootSprayController";

import WalkModeController from "../js/WalkModeController";
import { getActiveThreedEditor } from "../services/threedEditorRegistry";

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

// First-person walk mode (W in the 3D viewer). Bridges Redux to the
// imperative WalkModeController: W toggles walkMode.active, the controller
// owns the camera while active, Space fires the concrete lance toward the
// screen center (crosshair in ShootLanceOverlayThreed).
export default function useWalkMode() {
  const dispatch = useDispatch();
  const store = useStore();

  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  const isThreedViewer = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const mainBaseMap = useMainBaseMap();

  const controllerRef = useRef(null);

  // Ground = the selected baseMap plane. Prefer the live group's world Y
  // (reflects an in-flight gizmo move); fall back to the persisted transform.
  // VERTICAL baseMaps are walls, not floors — walk on the world ground then.
  let groundY = 0;
  const transform = getBaseMapTransform(mainBaseMap);
  if (mainBaseMap && transform.orientation === "HORIZONTAL") {
    const group =
      getActiveThreedEditor()?.sceneManager?.imagesManager?.getGroup?.(
        mainBaseMap.id
      );
    groundY = group
      ? group.getWorldPosition(new Vector3()).y
      : transform.position.y;
  }
  const groundYRef = useRef(groundY);
  groundYRef.current = groundY;

  // W hotkey — only while a 3D-family viewer is effectively displayed.
  useEffect(() => {
    if (!isThreedViewer) return;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== "w") return;

      const active = store.getState().threedEditor.walkMode.active;
      if (!active) {
        // Pointer lock needs the user gesture: request it synchronously in
        // the keydown handler, not from the controller-mount effect.
        getActiveThreedEditor()?.sceneManager?.renderer?.domElement?.requestPointerLock?.();
      }
      dispatch(setWalkModeActive(!active));
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isThreedViewer, store, dispatch]);

  // Safety: leaving the 3D viewer (or unmounting) while walking exits walk
  // mode; the controller effect's cleanup does the actual teardown.
  useEffect(() => {
    if (!isThreedViewer && walkActive) dispatch(setWalkModeActive(false));
  }, [isThreedViewer, walkActive, dispatch]);

  // Controller lifecycle. Must NOT depend on the baseMap: re-running the
  // effect would bounce the pointer lock — ground changes flow through
  // setGroundY below instead.
  useEffect(() => {
    if (!walkActive) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    if (!sceneManager?.controlsManager?.cameraControls) {
      dispatch(setWalkModeActive(false));
      return;
    }

    const spray = createShootSprayController({ editor, sceneManager });
    const controller = new WalkModeController({
      sceneManager,
      groundY: groundYRef.current,
      onRequestExit: () => dispatch(setWalkModeActive(false)),
      onFire: () => {
        const target = pickWorldTargetAtNdc({ sceneManager, ndcX: 0, ndcY: 0 });
        if (!target) return;
        spray.fire({ origin: getMuzzleOrigin(sceneManager), target });
        emitShoot({ firingUntil: Date.now() + 1000 }); // lance recoil
      },
    });
    controller.enter();
    controllerRef.current = controller;

    return () => {
      controllerRef.current = null;
      controller.exit();
      spray.dispose();
      emitShoot({ aim: null, firingUntil: 0 });
    };
  }, [walkActive, dispatch]);

  // Switching the selected baseMap mid-walk re-targets gravity.
  useEffect(() => {
    controllerRef.current?.setGroundY(groundY);
  }, [groundY]);
}
