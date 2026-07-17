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
  pickWorldHitAtNdc,
  getMuzzleOrigin,
} from "Features/threedMesh/services/shootPick";
import { createShootSprayController } from "Features/threedMesh/services/shootSprayController";
import { getSplatLayer } from "Features/threedMesh/services/shootSplatsLayer";

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

    const spray = createShootSprayController({
      editor,
      sceneManager,
      // Walk-mode jet: high-pressure resin stream — needle-thin grey
      // droplets at the nozzle exit that bloom toward the impact, in a very
      // tight cone, nearly straight to the target.
      options: {
        particleCount: 1200,
        particleSizeStart: 0.012,
        particleSizeEnd: 0.09,
        spreadDeg: 0.8,
        gravityY: -1,
        crossingTimeS: 0.18,
        color: 0x8d8d8d,
        opacity: 0.9,
        // Droplets landing on a face leave in-memory paint dots (write on
        // the walls!); nothing persisted, cleared on reload.
        leaveSplats: true,
        splatSize: 0.06,
      },
    });
    // Live aim of the stream, re-read every frame while Space is held.
    // Origin: with the RPG image displayed, the jet exits its nozzle —
    // measure the on-screen image rect (robust to resize and to the CSS
    // tilt) and place the muzzle at the configured anchor
    // (features.walkMode.muzzleAnchor, fractions of the image rect from its
    // top-left). Fallback: the bottom-center muzzle of the SVG lance.
    // Target: the point under the screen-center crosshair.
    const getStreamAim = () => {
      const { point: target, isHit } = pickWorldHitAtNdc({
        sceneManager,
        ndcX: 0,
        ndcY: 0,
      });
      if (!target) return null;
      const walkConfig = store.getState().appConfig.value?.features?.walkMode;
      const weaponEl = document.querySelector('[data-walk-rpg-weapon="true"]');
      const canvasRect =
        sceneManager.renderer.domElement.getBoundingClientRect();
      let origin = null;
      if (weaponEl && canvasRect.width && canvasRect.height) {
        const anchor = walkConfig?.muzzleAnchor ?? {};
        const anchorX = Number.isFinite(anchor.x) ? anchor.x : 0.2;
        const anchorY = Number.isFinite(anchor.y) ? anchor.y : 0.12;
        const weaponRect = weaponEl.getBoundingClientRect();
        const px = weaponRect.left + anchorX * weaponRect.width;
        const py = weaponRect.top + anchorY * weaponRect.height;
        origin = getMuzzleOrigin(sceneManager, {
          ndcX: ((px - canvasRect.left) / canvasRect.width) * 2 - 1,
          ndcY: -((py - canvasRect.top) / canvasRect.height) * 2 + 1,
          dist: 0.8,
        });
      }
      if (!origin) origin = getMuzzleOrigin(sceneManager);
      return { origin, target, targetIsSurface: isHit };
    };

    const controller = new WalkModeController({
      sceneManager,
      groundY: groundYRef.current,
      onRequestExit: () => dispatch(setWalkModeActive(false)),
      // Space held = continuous jet; the recoil/shake animation of the
      // weapon overlay runs for the whole hold (firingUntil far ahead,
      // reset on release).
      onFireStart: () => {
        spray.startStream(getStreamAim);
        emitShoot({ firingUntil: Date.now() + 3600 * 1000 });
      },
      onFireStop: () => {
        spray.stopStream();
        emitShoot({ firingUntil: 0 });
      },
      // R wipes the in-memory graffiti off the walls.
      onClearSplats: () => {
        getSplatLayer(sceneManager)?.clear();
        editor.renderScene?.();
      },
    });
    controller.enter();
    controllerRef.current = controller;

    return () => {
      controllerRef.current = null;
      controller.exit();
      spray.dispose();
      emitShoot({ firingUntil: 0 });
    };
  }, [walkActive, dispatch, store]);

  // Switching the selected baseMap mid-walk re-targets gravity.
  useEffect(() => {
    controllerRef.current?.setGroundY(groundY);
  }, [groundY]);
}
