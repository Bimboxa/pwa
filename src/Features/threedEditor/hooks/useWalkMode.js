import { useEffect, useMemo, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";
import { Vector3 } from "three";

import { setWalkModeActive } from "Features/threedEditor/threedEditorSlice";

import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectPdfEditorOpen } from "Features/pdfEditor/pdfEditorSlice";
import { prepareScene3dPicking } from "Features/scene3d/services/intersectScene3d";
import createScene3dGroundSampler from "Features/scene3d/utils/createScene3dGroundSampler";
import {
  ensureScene3dHeightMap,
  getScene3dHeightMap,
} from "Features/scene3d/services/scene3dHeightMapStore";
import {
  DEFAULT_WALK_TOOL,
  emitShoot,
  resetShoot,
} from "Features/threedMesh/services/shootAimStore";
import {
  pickWorldHitAtNdc,
  getMuzzleOrigin,
} from "Features/threedMesh/services/shootPick";
import { createShootSprayController } from "Features/threedMesh/services/shootSprayController";
import { getSplatLayer } from "Features/threedMesh/services/shootSplatsLayer";

import WalkModeController from "../js/WalkModeController";
import { createWalkMeasureController } from "../services/walkMeasureController";
import { getActiveThreedEditor } from "../services/threedEditorRegistry";
import { WALK_MODE_TOGGLE_KEY, toggleWalkMode } from "../utils/walkModeToggle";

// + / - nozzle-aperture step, per keydown (incl. OS key-repeat while held).
// Multiplicative: the clamp range spans two orders of magnitude, a single
// tap gives a visible ±20% and holding ~1.3 s sweeps the whole range.
const SPREAD_STEP_FACTOR = 1.2;
// HUD crosshair-to-target distance refresh (same center raycast as the
// spray aim and the measure preview; 10 Hz is plenty for a readout).
const TARGET_DIST_POLL_MS = 100;

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

// First-person walk mode (P in the 3D viewer, see walkModeToggle). Bridges
// Redux to the imperative WalkModeController: P toggles walkMode.active, the
// controller owns the camera while active, Space is the primary action of
// the current walk tool (O switches): the concrete lance streams toward the
// screen center (crosshair in ShootLanceOverlayThreed), the measure tool
// shoots two points and draws an ephemeral dimension between them.
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
  // Photo baseMaps have no plane in the scene at all — world ground too.
  let groundY = 0;
  const transform = getBaseMapTransform(mainBaseMap);
  if (
    mainBaseMap &&
    !mainBaseMap.isPhoto &&
    transform.orientation === "HORIZONTAL"
  ) {
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

  // Scan base map: walk on the scan relief (height map) rather than on its
  // plane. The sampler reads the height map lazily — null (still loading,
  // outside the zone, empty cell) falls back to the plane in the controller.
  const sceneId = mainBaseMap?.scene3d?.sceneId ?? null;
  const groundSampler = useMemo(() => {
    if (!sceneId || transform.orientation !== "HORIZONTAL") return null;
    return createScene3dGroundSampler({
      baseMap: mainBaseMap,
      transform,
      planeY: groundY,
      getHeightMap: () => getScene3dHeightMap(sceneId),
    });
    // The transform is rebuilt every render: key on its scalar parts.
  }, [
    sceneId,
    mainBaseMap,
    groundY,
    transform.orientation,
    transform.angleDeg,
    transform.position.x,
    transform.position.z,
  ]);
  const groundSamplerRef = useRef(groundSampler);
  groundSamplerRef.current = groundSampler;

  // Make the height map of the scan available while walking (rasterized at
  // import; rebuilt once for older scans — see scene3dHeightMapStore).
  useEffect(() => {
    if (!walkActive || !sceneId) return;
    ensureScene3dHeightMap(sceneId, {
      bbox: mainBaseMap?.scene3d?.bbox,
      projectId: mainBaseMap?.projectId,
    });
  }, [walkActive, sceneId, mainBaseMap]);

  // P hotkey — only while a 3D-family viewer is effectively displayed.
  // Registered at mount, i.e. BEFORE the controller's capture listeners: P
  // reaches this toggle first and exits the mode too.
  useEffect(() => {
    if (!isThreedViewer) return;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== WALK_MODE_TOGGLE_KEY) return;
      const s = store.getState();
      // The PDF editor layer covers the 3D editor: no pointer lock under it.
      if (selectPdfEditorOpen(s)) return;
      // A live 3D draw owns its letters.
      if (s.mapEditor.enabledDrawingMode) return;

      toggleWalkMode({ store, dispatch });
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
    const measure = createWalkMeasureController({ sceneManager, editor });

    // Walk tool, walk-local (resets to the laser meter on every entry).
    // Mirrored into the shootAimStore for the HUD / weapon image.
    let tool = DEFAULT_WALK_TOOL;

    // Seed the HUD (ShootLanceOverlayThreed) before any key press.
    resetShoot();
    emitShoot({ ...spray.getJetState(), tool });

    // Point under the screen-center crosshair (real surface — meshes AND
    // scan base maps — or void). The scan picking data is built on demand
    // (first pick); start it right away so the first shots land on the scan.
    prepareScene3dPicking(editor);
    const centerPick = () =>
      pickWorldHitAtNdc({ sceneManager, ndcX: 0, ndcY: 0, editor });

    const emitMeasureState = () => {
      const st = measure.getState();
      emitShoot({
        measureHasStart: !!st.startPoint,
        measureCount: st.measures.length,
      });
    };

    // Live aim of the stream, re-read every frame while Space is held.
    // Origin: with the RPG image displayed, the jet exits its nozzle —
    // measure the on-screen image rect (robust to resize and to the CSS
    // tilt) and place the muzzle at the configured anchor
    // (features.walkMode.muzzleAnchor, fractions of the image rect from its
    // top-left). Fallback: the bottom-center muzzle of the SVG lance.
    // Target: the point under the screen-center crosshair.
    const getStreamAim = () => {
      const { point: target, isHit } = centerPick();
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
      sampleGroundY: groundSamplerRef.current,
      onRequestExit: () => dispatch(setWalkModeActive(false)),
      // Space pressed. Lance: continuous jet while held, the recoil/shake
      // animation of the weapon overlay runs for the whole hold (firingUntil
      // far ahead, reset on release). Measure: one shot = one point, only
      // on a real surface (the void is not measurable).
      onPrimaryStart: () => {
        if (tool === "MEASURE") {
          const { point, isHit } = centerPick();
          if (!isHit) return;
          measure.shoot(point);
          emitShoot({ measureLiveM: null });
          emitMeasureState();
          return;
        }
        spray.startStream(getStreamAim);
        emitShoot({ firingUntil: Date.now() + 3600 * 1000 });
      },
      onPrimaryStop: () => {
        if (tool === "MEASURE") return;
        spray.stopStream();
        emitShoot({ firingUntil: 0 });
      },
      // O: lance <-> measure. A running jet stops, a pending first point is
      // dropped; committed measures and paint splats both survive.
      onSwitchTool: () => {
        spray.stopStream();
        measure.cancelStart();
        tool = tool === "LANCE" ? "MEASURE" : "LANCE";
        emitShoot({ tool, firingUntil: 0, measureLiveM: null });
        emitMeasureState();
      },
      // Backspace / Delete: wipe the current tool's traces — the in-memory
      // graffiti off the walls, or every measure.
      onClear: () => {
        if (tool === "MEASURE") {
          measure.clearAll();
          emitShoot({ measureLiveM: null });
          emitMeasureState();
          return;
        }
        getSplatLayer(sceneManager)?.clear();
        editor.renderScene?.();
      },
      // B / + / - nozzle tuning — mutators return the fresh {jetMode,
      // spreadDeg} which feeds the HUD readout.
      onCycleJetMode: () => emitShoot(spray.cycleJetMode()),
      onSprayWiden: () => emitShoot(spray.scaleSpread(SPREAD_STEP_FACTOR)),
      onSprayNarrow: () => emitShoot(spray.scaleSpread(1 / SPREAD_STEP_FACTOR)),
    });
    controller.enter();
    controllerRef.current = controller;

    // Live crosshair-to-target distance for the HUD (null = the void) and,
    // with the measure tool armed, the dashed preview + live length.
    const distIntervalId = setInterval(() => {
      const { point, isHit } = centerPick();
      const targetDistM =
        isHit && point ? sceneManager.camera.position.distanceTo(point) : null;
      if (tool === "MEASURE") {
        const measureLiveM = measure.updatePreview(isHit ? point : null);
        emitShoot({ targetDistM, measureLiveM });
      } else {
        emitShoot({ targetDistM });
      }
    }, TARGET_DIST_POLL_MS);

    return () => {
      controllerRef.current = null;
      clearInterval(distIntervalId);
      controller.exit();
      spray.dispose();
      measure.dispose();
      resetShoot();
    };
  }, [walkActive, dispatch, store]);

  // Switching the selected baseMap mid-walk re-targets gravity.
  useEffect(() => {
    controllerRef.current?.setGroundY(groundY);
  }, [groundY]);
  useEffect(() => {
    controllerRef.current?.setGroundSampler(groundSampler);
  }, [groundSampler]);
}
