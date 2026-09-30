import {
  Box3,
  Clock,
  MathUtils,
  Matrix4,
  Plane,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import CameraControls from "camera-controls";

import { loadNavigationPreset } from "Features/threedEditor/services/navigationPresetLocalStorage";

import resolveNavigationMouseActions from "Features/threedEditor/utils/resolveNavigationMouseActions";

// Far plane of the camera at the default view distance (SceneManager).
const DEFAULT_CAMERA_FAR = 1000;

// camera-controls must be installed once with a (subset of) three before use.
// We pass only the classes it needs so three stays tree-shakeable elsewhere.
CameraControls.install({
  THREE: {
    Box3,
    MathUtils,
    Matrix4,
    Quaternion,
    Raycaster,
    Sphere,
    Spherical,
    Vector2,
    Vector3,
    Vector4,
  },
});

// A mesh whose material is (nearly) see-through must not capture the rotation
// pivot — e.g. annotations dimmed to opacity 0.3 after a solo selection. The
// ray should pass through and land on the opaque geometry (or plane) behind.
const PIVOT_OPACITY_THRESHOLD = 0.99;

// camera-controls `mouseButtons` keys, indexed by PointerEvent.button.
const MOUSE_BUTTON_NAMES = ["left", "middle", "right"];

function isMaterialSeeThrough(material) {
  if (!material) return false;
  if (Array.isArray(material)) return material.some(isMaterialSeeThrough);
  if (material.transparent === true) return true;
  return (
    typeof material.opacity === "number" &&
    material.opacity < PIVOT_OPACITY_THRESHOLD
  );
}

export default class ControlsManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.cameraControls = null;

    // camera-controls processes pointer/wheel input INSIDE update(delta) and
    // applies damping there, so update() must run every frame. We keep a
    // continuous rAF loop that always calls update() but only re-renders when
    // the camera actually changed (update() returns true) — rendering stays
    // effectively on-demand, only the (cheap) update tick is continuous.
    this._clock = new Clock();
    this._rafId = null;
    this._disposed = false;

    // While suspended (walk mode), the loop skips cameraControls.update()
    // entirely: update() rewrites camera.position and lookAt(target) every
    // call — even when `enabled` is false — which would clobber a camera
    // pose owned by another controller.
    this._suspended = false;

    // maxDistance stashed by animateFovTo, restored by restorePerspectiveFov.
    this._stashedMaxDistance = null;
    // Regular range requested while a transition had lifted the limit (see
    // setRegularMaxDistance), applied when the transition ends.
    this._deferredMaxDistance = null;

    // Mouse navigation preset (device preference). Read from localStorage so
    // the editor starts on the right mapping; MainThreedEditor then keeps it
    // in sync with the redux value (setNavigationPreset).
    this._navigationPreset = loadNavigationPreset();
    this._domElement = null;
    // Zoom-out range lent to a temporarily larger scene (3D base maps grid):
    // { baseMaxDistance, maxDistance, baseFar, far } — see setDistanceBoost.
    this._distanceBoost = null;

    // Pivot-under-cursor scratch objects — allocated once, reused per event.
    this._pivotRaycaster = new Raycaster();
    this._pivotNdc = new Vector2();
    this._pivotPlane = new Plane();
    this._pivotPlaneNormal = new Vector3();
    this._pivotQuat = new Quaternion();
    this._pivotHit = new Vector3();
    this._pivotBest = new Vector3();
  }

  // Backward-compat alias: the lasso (MainThreedEditor) and the gizmos
  // (TransformControlsManager, ClippingManager) toggle `.enabled` on what they
  // call `orbitControls`. camera-controls exposes the same `.enabled` flag, so
  // exposing it under the old name keeps those call sites untouched.
  get orbitControls() {
    return this.cameraControls;
  }

  initControls = () => {
    this.cameraControls = new CameraControls(
      this.sceneManager.camera,
      this.sceneManager.renderer.domElement
    );

    // Stable reference fov for the 2D/3D switch dolly-zoom: reading the live
    // camera.fov is fragile (a pending fov restore would be read back as the
    // reference).
    this.referenceFov = this.sceneManager.camera?.fov ?? 75;

    // Match the previous OrbitControls feel.
    this.cameraControls.minDistance = 0.1;
    this.cameraControls.maxDistance = 500;
    this.cameraControls.smoothTime = 0.1; // settle/transition damping (s)
    this.cameraControls.draggingSmoothTime = 0.05; // snappier while dragging
    // Wheel zoom converges toward the point under the cursor.
    this.cameraControls.dollyToCursor = true;

    // Lower navigation sensitivity (camera-controls defaults are 1.0 rotate,
    // 2.0 truck, 1.0 dolly). Halve them for a calmer, more precise feel.
    this.cameraControls.azimuthRotateSpeed = 0.5; // orbit (horizontal)
    this.cameraControls.polarRotateSpeed = 0.5; // orbit (vertical)
    this.cameraControls.truckSpeed = 1.0; // pan
    this.cameraControls.dollySpeed = 0.5; // zoom

    // Mouse mapping = the navigation preset (constants/navigationPresets);
    // wheel stays DOLLY in every preset. STANDARD: left = ROTATE, right =
    // TRUCK (pan). Right-drag is awkward on a Mac trackpad, so presets also
    // bind a modifier key that swaps a button action while it is held (e.g.
    // Option(Alt) + left-drag = pan in STANDARD) — see _onModifierKey / window
    // blur reset below.
    this._domElement = this.sceneManager.renderer.domElement;
    this._applyMouseButtons({});
    window.addEventListener("keydown", this._onModifierKey);
    window.addEventListener("keyup", this._onModifierKey);
    window.addEventListener("blur", this._onWindowBlur);
    // Capture phase: runs before camera-controls' own pointerdown listener.
    this._domElement.addEventListener(
      "pointerdown",
      this._onPointerDownCapture,
      true
    );
    this._domElement.addEventListener("mousedown", this._onMouseDown);

    // Prime the internal matrices, render once, then start the update loop.
    this.cameraControls.update(0);
    this.sceneManager.renderScene();
    this._clock.getDelta(); // reset delta so the first frame isn't a huge step
    this._loop();
  };

  // ----- navigation preset (mouse buttons + modifier keys) --------------

  setNavigationPreset = (presetKey) => {
    this._navigationPreset = presetKey;
    this._applyMouseButtons({});
  };

  // Write the preset's button actions for the modifier keys currently held
  // (`modifierState`: any event / object with altKey, ctrlKey, metaKey,
  // shiftKey). Only mutate on a real change so we don't disturb an in-flight
  // gesture every keyrepeat.
  _applyMouseButtons = (modifierState) => {
    const controls = this.cameraControls;
    if (!controls) return;
    const actions = resolveNavigationMouseActions(
      this._navigationPreset,
      modifierState
    );
    MOUSE_BUTTON_NAMES.forEach((name) => {
      const want = CameraControls.ACTION[actions[name]];
      if (controls.mouseButtons[name] !== want) {
        controls.mouseButtons[name] = want;
      }
    });
  };

  _onModifierKey = (event) => {
    this._applyMouseButtons(event);
  };

  // If focus leaves the window while a modifier is held, the keyup never
  // arrives — reset to the preset's base mapping so a button isn't stuck on
  // its modified action.
  _onWindowBlur = () => {
    this._applyMouseButtons({});
  };

  // Re-sync from the pointer event itself: a modifier pressed while the
  // window was not focused never fired its keydown.
  _onPointerDownCapture = (event) => {
    this._applyMouseButtons(event);
  };

  // The middle button navigates (dolly / orbit depending on the preset): stop
  // the browser's middle-click auto-scroll from hijacking the drag.
  _onMouseDown = (event) => {
    if (event.button === 1) event.preventDefault();
  };

  // True when the pressed button starts a gesture that should re-anchor the
  // orbit point under the cursor (see updateRotationPivotFromEvent): an orbit,
  // or a pan held by the left / middle button (the grabbed point then stays
  // under the cursor). Right-drag pan keeps the current orbit point.
  isPivotGesture = (event) => {
    if (event.pointerType === "touch") return true;
    const name = MOUSE_BUTTON_NAMES[event.button];
    if (!name) return false;
    const actions = resolveNavigationMouseActions(
      this._navigationPreset,
      event
    );
    const action = actions[name];
    if (action === "ROTATE") return true;
    return action === "TRUCK" && name !== "right";
  };

  // ----- continuous update loop (render only on change) ----------------

  // Walk mode owns the camera: pause the update loop (rendering included —
  // the walk controller renders). On resume, flush the accumulated clock
  // delta so the suspended time isn't integrated as one huge damping step.
  setSuspended = (suspended) => {
    this._suspended = !!suspended;
    if (!suspended) this._clock.getDelta();
  };

  _loop = () => {
    if (this._disposed) return;
    if (this._suspended) {
      this._rafId = requestAnimationFrame(this._loop);
      return;
    }
    const delta = this._clock.getDelta();
    const updated = this.cameraControls.update(delta);
    if (updated) {
      this.sceneManager.renderScene();
    }
    this._rafId = requestAnimationFrame(this._loop);
  };

  dispose = () => {
    this._disposed = true;
    window.removeEventListener("keydown", this._onModifierKey);
    window.removeEventListener("keyup", this._onModifierKey);
    window.removeEventListener("blur", this._onWindowBlur);
    if (this._domElement) {
      this._domElement.removeEventListener(
        "pointerdown",
        this._onPointerDownCapture,
        true
      );
      this._domElement.removeEventListener("mousedown", this._onMouseDown);
      this._domElement = null;
    }
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this.cameraControls) {
      this.cameraControls.dispose();
      this.cameraControls = null;
    }
  };

  // ----- camera framing -------------------------------------------------

  // Pan the orbit center onto `worldPoint` (camera follows by the same delta,
  // so orientation and zoom are preserved) with a smooth transition.
  panCameraToWorldPoint = (worldPoint) => {
    if (!this.cameraControls || !worldPoint) return;
    this.cameraControls.setTarget(
      worldPoint.x,
      worldPoint.y,
      worldPoint.z,
      true // enableTransition
    );
  };

  // Union box of all annotation meshes (the useAnnotationsV2 set already
  // loaded into the scene). When the scene has no annotations, a 10 m cube
  // resting on the ground (y=0) and centered on the world origin.
  _computeAnnotationsBox = () => {
    const box = new Box3();
    box.makeEmpty();
    let hasAny = false;

    const annotations =
      this.sceneManager.annotationsManager?.annotationsObjectsMap || {};
    Object.values(annotations).forEach((obj) => {
      if (!obj) return;
      const b = new Box3().setFromObject(obj);
      if (!b.isEmpty() && isFinite(b.min.x)) {
        box.union(b);
        hasAny = true;
      }
    });

    if (!hasAny) {
      // No annotation: 10 m × 10 m × 10 m cube, bottom on the ground plane.
      box.set(new Vector3(-5, 0, -5), new Vector3(5, 10, 5));
    }
    return box;
  };

  // Frame all annotation meshes. Preserves the current orbit orientation and
  // only dollies/pans to fit.
  fitToAnnotations = () => {
    if (!this.cameraControls) return;

    const box = this._computeAnnotationsBox();
    const padding = 0.5; // metres of breathing room around the geometry
    this.cameraControls.fitToBox(box, true, {
      paddingLeft: padding,
      paddingRight: padding,
      paddingTop: padding,
      paddingBottom: padding,
    });
  };

  // Frame an arbitrary world-space Box3 (e.g. one maille). Preserves the
  // current orbit orientation and only dollies/pans to fit.
  fitToBox3 = (box) => {
    if (!this.cameraControls || !box || box.isEmpty()) return;

    const padding = 0.5; // metres of breathing room around the geometry
    this.cameraControls.fitToBox(box, true, {
      paddingLeft: padding,
      paddingRight: padding,
      paddingTop: padding,
      paddingBottom: padding,
    });
  };

  // Lends a larger zoom-out range (dolly limit + camera far plane) to a scene
  // that temporarily outgrows the regular one — the 3D base maps grid lays
  // the base maps as paper sheets at the scale of the main one, a table that
  // can span kilometres. No-op when the regular range already covers it.
  // The regular dolly limit may be parked in the stash (ortho-like fov of the
  // 3D → 2D switch): the boost is then applied there.
  setDistanceBoost = (distance) => {
    const controls = this.cameraControls;
    const camera = this.sceneManager?.camera;
    if (!controls || !camera) return;
    this.clearDistanceBoost();
    if (!Number.isFinite(distance) || distance <= 0) return;

    const stashed = this._stashedMaxDistance != null;
    const baseMaxDistance = stashed
      ? this._stashedMaxDistance
      : controls.maxDistance;
    const baseFar = camera.far;
    const maxDistance = Math.max(baseMaxDistance, distance);
    const far = Math.max(baseFar, 2 * maxDistance);
    this._distanceBoost = {
      baseMaxDistance,
      maxDistance,
      baseFar,
      far,
      requested: distance,
    };

    if (stashed) this._stashedMaxDistance = maxDistance;
    else controls.maxDistance = maxDistance;
    if (far !== baseFar) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  };

  // Sets the REGULAR zoom-out range (dolly limit + camera far plane at twice
  // the distance): the "Distance de vue max" setting, or its AUTO value
  // derived from the loaded SCENE_3D scans. A boost in progress (base maps
  // grid) is re-applied on top of the new range; a limit parked in the stash
  // (ortho-like fov of the 3D → 2D switch) is updated there.
  setRegularMaxDistance = (distance) => {
    const controls = this.cameraControls;
    const camera = this.sceneManager?.camera;
    if (!controls || !camera) return;
    if (!Number.isFinite(distance) || distance <= 0) return;

    const boostRequest = this._distanceBoost?.requested ?? null;
    this.clearDistanceBoost();

    if (this._stashedMaxDistance != null) {
      this._stashedMaxDistance = distance;
    } else if (controls.maxDistance === Infinity) {
      // A camera transition (2D → 3D entry) has lifted the limit for its
      // duration: clamping now would snap the camera mid-flight. Handed over
      // when the transition puts the limit back.
      this._deferredMaxDistance = distance;
    } else {
      controls.maxDistance = distance;
    }
    const far = Math.max(DEFAULT_CAMERA_FAR, 2 * distance);
    if (camera.far !== far) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }

    if (boostRequest != null) this.setDistanceBoost(boostRequest);
    this.sceneManager.requestRender?.();
  };

  // Gives the regular range back. The camera is never pulled in: when it
  // stands beyond the regular limit, the limit stays at its distance (it can
  // still come closer, not go further).
  clearDistanceBoost = () => {
    const boost = this._distanceBoost;
    const controls = this.cameraControls;
    const camera = this.sceneManager?.camera;
    if (!boost || !controls || !camera) return;
    this._distanceBoost = null;

    const distance = controls.distance;
    const maxDistance = Math.max(
      boost.baseMaxDistance,
      Number.isFinite(distance) ? distance : 0
    );
    if (this._stashedMaxDistance === boost.maxDistance) {
      this._stashedMaxDistance = maxDistance;
    } else if (controls.maxDistance === boost.maxDistance) {
      controls.maxDistance = maxDistance;
    }
    const far = Math.max(boost.baseFar, 2 * maxDistance);
    if (camera.far === boost.far && far !== camera.far) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  };

  // Face-on framing of a world-space Box3: pivot the camera onto the plane
  // normal (side = 1 / -1 picks which of the two faces), then fit the box
  // head-on. Without an explicit side, the face the camera is already on is
  // used. Returns the side actually applied, so callers can flip to the
  // other face on their next call.
  fitToBox3Facing = async (box, normal, side = null) => {
    if (!this.cameraControls || !box || box.isEmpty()) return null;
    if (!normal) {
      this.fitToBox3(box);
      return null;
    }

    const center = box.getCenter(new Vector3());
    const n = new Vector3(normal.x, normal.y, normal.z).normalize();

    let appliedSide = side === 1 || side === -1 ? side : null;
    if (!appliedSide) {
      const toCamera = this.cameraControls
        .getPosition(new Vector3())
        .sub(center);
      appliedSide = toCamera.dot(n) >= 0 ? 1 : -1;
    }

    // Spherical angles of the camera direction (center → camera) along the
    // picked normal side, in camera-controls' Y-up convention. Polar is kept
    // off the exact poles (same degeneracy guard as animateToTopDown).
    const dir = n.multiplyScalar(appliedSide);
    const azimuthRad = Math.atan2(dir.x, dir.z);
    const polarRad = Math.min(
      Math.PI - 0.001,
      Math.max(0.001, Math.acos(Math.min(1, Math.max(-1, dir.y))))
    );

    await this.animateToTopDown({ target: center, azimuthRad, polarRad });
    this.fitToBox3(box);
    return appliedSide;
  };

  // Top-down framing of every annotation in the scene: pivot to a vertical
  // look-down view around the annotations' center, then fit the box with the
  // settled orientation (fitToBox frames along the current view direction).
  // Used by the Viewer module's initial framing on scope open.
  fitToAnnotationsTopDown = async () => {
    if (!this.cameraControls) return;

    const box = this._computeAnnotationsBox();
    const center = box.getCenter(new Vector3());
    await this.animateToTopDown({ target: center });
    const padding = 0.5;
    await this.cameraControls.fitToBox(box, true, {
      paddingLeft: padding,
      paddingRight: padding,
      paddingTop: padding,
      paddingBottom: padding,
    });
  };

  // Jump the camera to an explicit pose, no transition. Used by the 2D->3D
  // viewer switch to pre-position the (hidden) 3D view before it is shown.
  applyPoseInstant = ({ position, target }) => {
    if (!this.cameraControls || !position || !target) return;
    this.cameraControls.setLookAt(
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      false // no transition
    );
  };

  // 2D->3D entry: jump (no transition) to a near-ortho pose — narrow `fovFrom`
  // with the matching far distance — then animate the fov to `fovTo` while
  // dollying in to keep the target-plane scale constant (dolly zoom). The user
  // sees the flat view progressively gain perspective.
  applyPoseAndAnimateFov = async ({
    position,
    target,
    fovFrom,
    fovTo,
    durationMs = 500,
  }) => {
    const controls = this.cameraControls;
    const camera = this.sceneManager?.camera;
    if (!controls || !camera || !position || !target) return;

    const prevEnabled = controls.enabled;
    const prevMaxDistance = controls.maxDistance;
    try {
      controls.enabled = false; // ignore user input mid-flight
      // The near-ortho start pose sits farther than the interactive dolly
      // limit; lift it for the duration of the transition.
      controls.maxDistance = Infinity;

      // The pose is EXACT (position + look axis). setLookAt does not reset
      // camera-controls' focal offset, and a stale one (left by the
      // orbit-around-cursor setOrbitPoint calls) would be re-applied on top
      // of the pose as a lateral shift — zero it first.
      controls.setFocalOffset(0, 0, 0, false);

      camera.fov = fovFrom;
      camera.updateProjectionMatrix();
      controls.setLookAt(
        position.x,
        position.y,
        position.z,
        target.x,
        target.y,
        target.z,
        false
      );
      controls.update(0); // apply the pose now, before the panel is revealed
      this.sceneManager.renderScene();

      const distance = Math.hypot(
        position.x - target.x,
        position.y - target.y,
        position.z - target.z
      );
      await this._animateFovKeepingScale({ fovTo, durationMs, distance });
    } finally {
      // The end distance (reference fov) is back within the normal limits
      // (a regular range set meanwhile — setRegularMaxDistance — wins).
      controls.maxDistance = this._deferredMaxDistance ?? prevMaxDistance;
      this._deferredMaxDistance = null;
      controls.enabled = prevEnabled;
    }
  };

  // 3D->2D: flatten the perspective (fov -> near-ortho) while dollying out to
  // keep the plan scale constant. maxDistance stays lifted afterwards (the end
  // pose is far away); `restorePerspectiveFov` puts it back once the 2D viewer
  // is shown.
  animateFovTo = async ({ fovTo, durationMs = 500 }) => {
    const controls = this.cameraControls;
    const camera = this.sceneManager?.camera;
    if (!controls || !camera) return;

    const prevEnabled = controls.enabled;
    try {
      controls.enabled = false;
      if (this._stashedMaxDistance == null) {
        this._stashedMaxDistance = controls.maxDistance;
      }
      controls.maxDistance = Infinity;
      await this._animateFovKeepingScale({ fovTo, durationMs });
    } finally {
      controls.enabled = prevEnabled;
    }
  };

  // Put the camera back on the reference fov (same target-plane scale) and
  // restore the dolly limit stashed by `animateFovTo`. Called on the hidden
  // 3D view right after the switch to 2D.
  restorePerspectiveFov = ({ fovDeg }) => {
    const controls = this.cameraControls;
    const camera = this.sceneManager?.camera;
    if (!controls || !camera || !(fovDeg > 0)) return;

    // Keep h = 2 * d * tan(fov/2) constant across the fov change.
    const h = 2 * controls.distance * Math.tan((camera.fov * Math.PI) / 360);
    camera.fov = fovDeg;
    camera.updateProjectionMatrix();

    if (this._stashedMaxDistance != null) {
      controls.maxDistance = this._stashedMaxDistance;
      this._stashedMaxDistance = null;
    }
    const d = h / (2 * Math.tan((fovDeg * Math.PI) / 360));
    controls.dollyTo(
      Math.min(controls.maxDistance, Math.max(controls.minDistance, d)),
      false
    );
  };

  // Shared dolly-zoom driver: ease the fov to `fovTo` over `durationMs`,
  // adjusting the dolly distance each frame so the target plane keeps the
  // same on-screen size. Rendering is handled by the continuous _loop (the
  // per-frame dollyTo marks the controls dirty).
  _animateFovKeepingScale = ({ fovTo, durationMs, distance }) =>
    new Promise((resolve) => {
      const controls = this.cameraControls;
      const camera = this.sceneManager?.camera;
      if (!controls || !camera || !(durationMs > 0) || !(fovTo > 0)) {
        resolve();
        return;
      }

      const fovFrom = camera.fov;
      const d0 = Number.isFinite(distance) ? distance : controls.distance;
      const h = 2 * d0 * Math.tan((fovFrom * Math.PI) / 360);
      const t0 = performance.now();

      const tick = (now) => {
        if (this._disposed || !this.cameraControls) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - t0) / durationMs);
        // easeInOutCubic
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const fov = fovFrom + (fovTo - fovFrom) * e;
        camera.fov = fov;
        camera.updateProjectionMatrix();
        this.cameraControls.dollyTo(
          h / (2 * Math.tan((fov * Math.PI) / 360)),
          false
        );
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });

  // Animate the camera to a plane-facing view of `target`, pivoting around it
  // (distance preserved): top-down for floor plans (polarRad slightly above 0
  // because camera-controls degenerates at an exactly vertical look
  // direction), head-on (polarRad = PI/2) for vertical walls. Resolves when
  // the transition has settled.
  animateToTopDown = async ({
    target,
    azimuthRad = 0,
    polarRad = 0.001,
    smoothTime = 0.15,
  }) => {
    const controls = this.cameraControls;
    if (!controls || !target) return;

    const prevSmoothTime = controls.smoothTime;
    const prevEnabled = controls.enabled;
    try {
      controls.enabled = false; // ignore user input mid-flight
      controls.smoothTime = smoothTime;
      // setOrbitPoint is immediate and view-preserving; the rotate below then
      // pivots around the new target.
      controls.setOrbitPoint(target.x, target.y, target.z);
      // Azimuth is unbounded in camera-controls: aim for the equivalent angle
      // nearest the current one so the camera takes the short way around.
      const azimuthNearest =
        azimuthRad +
        2 *
          Math.PI *
          Math.round((controls.azimuthAngle - azimuthRad) / (2 * Math.PI));
      await controls.rotateTo(azimuthNearest, polarRad, true);
      // The transition promise resolves at restThreshold (a few mrad off);
      // snap to the exact pose before anything is computed from it.
      controls.rotateTo(azimuthNearest, polarRad, false);
    } finally {
      controls.smoothTime = prevSmoothTime;
      controls.enabled = prevEnabled;
    }
  };

  // Apply the controls' current internal state to the camera object right
  // now (the _loop only does it on its next frame) so reads of the camera
  // matrices reflect the settled end-of-animation pose.
  syncCameraNow = () => {
    if (!this.cameraControls) return;
    this.cameraControls.update(0);
    this.sceneManager?.camera?.updateMatrixWorld(true);
  };

  // ----- orbit-around-cursor -------------------------------------------

  // Called on pointerdown (left button): set the orbit point to the point
  // under the cursor so the subsequent rotate gesture orbits around it.
  // camera-controls' setOrbitPoint preserves the current view (no jump).
  updateRotationPivotFromEvent = (event) => {
    if (!this.cameraControls?.enabled) return; // don't fight a gizmo/lasso drag

    const camera = this.sceneManager.camera;
    const dom = this.sceneManager.renderer.domElement;
    if (!camera || !dom) return;

    const rect = dom.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this._pivotNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pivotNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._pivotRaycaster.setFromCamera(this._pivotNdc, camera);

    const pivot = this._computePivotPoint();
    if (pivot) {
      // setOrbitPoint is immediate and must not run during a transition.
      this.cameraControls.setOrbitPoint(pivot.x, pivot.y, pivot.z);
    }
  };

  // Resolve the world point under the cursor, in priority order:
  //   (a) the nearest opaque mesh hit (see-through meshes are ignored so a
  //       dimmed annotation never captures the pivot),
  //   (b) the nearest basemap plane (infinite — robust even if the basemap
  //       image isn't drawn or is too small),
  //   (c) the ground plane y=0.
  // Returns a Vector3 (this._pivotBest) or null.
  _computePivotPoint = () => {
    const ray = this._pivotRaycaster;

    // (a) Meshes first.
    const scene = this.sceneManager.scene;
    if (scene) {
      const intersects = ray.intersectObjects(scene.children, true);
      for (const i of intersects) {
        if (i.object?.isMesh && !isMaterialSeeThrough(i.object.material)) {
          return this._pivotBest.copy(i.point);
        }
      }
    }

    // (b) Basemap planes (infinite), keep the nearest hit in front of the ray.
    const imagesMap = this.sceneManager.imagesManager?.imagesMap;
    let bestDistSq = Infinity;
    let found = false;
    if (imagesMap) {
      for (const id of Object.keys(imagesMap)) {
        const group = imagesMap[id];
        if (!group) continue;
        group.getWorldPosition(this._pivotHit);
        group.getWorldQuaternion(this._pivotQuat);
        this._pivotPlaneNormal.set(0, 0, 1).applyQuaternion(this._pivotQuat);
        this._pivotPlane.setFromNormalAndCoplanarPoint(
          this._pivotPlaneNormal,
          this._pivotHit
        );
        const point = ray.ray.intersectPlane(this._pivotPlane, this._pivotHit);
        if (point) {
          const distSq = ray.ray.origin.distanceToSquared(point);
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            this._pivotBest.copy(point);
            found = true;
          }
        }
      }
    }
    if (found) return this._pivotBest;

    // (c) Ground plane y=0.
    this._pivotPlane.setFromNormalAndCoplanarPoint(
      this._pivotPlaneNormal.set(0, 1, 0),
      this._pivotHit.set(0, 0, 0)
    );
    const ground = ray.ray.intersectPlane(this._pivotPlane, this._pivotHit);
    return ground ? this._pivotBest.copy(ground) : null;
  };
}
