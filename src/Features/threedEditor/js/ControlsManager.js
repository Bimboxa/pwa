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
import { isObjectChainVisible } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

import resolveNavigationMouseActions from "Features/threedEditor/utils/resolveNavigationMouseActions";

// Far plane of the camera at the default view distance (SceneManager).
const DEFAULT_CAMERA_FAR = 1000;
const DEFAULT_MAX_DISTANCE = 500;

// Perspective near plane following the orbit distance (_syncPerspectiveNear).
// A fixed 0.1 m near plane with minDistance = 0.1 m put the pivot ON the near
// plane at full zoom-in: everything between the camera and the pivot was
// sliced away. Capped at the historical 0.1 m so wide views keep their depth
// precision (the far plane reaches 2 x maxDistance).
const NEAR_DISTANCE_RATIO = 0.05;
const NEAR_MIN_M = 0.005;
const NEAR_MAX_M = 0.1;

// Wheel re-anchoring of the orbit point (_onWheelCapture): a new wheel burst
// starts after this silence, or when the cursor moved this far since the
// last anchoring.
const WHEEL_BURST_GAP_MS = 300;
const WHEEL_REANCHOR_MOVE_PX = 8;

// A pivot found on a fallback plane (the infinite extension of a base map,
// the ground y=0 — see _computePivotPoint) is accepted only within this
// multiple of the current orbit distance: a grazing hit hundreds of metres
// away would park the target far from everything on screen, and every
// gesture that scales with the orbit radius (dolly-to-cursor, orbit) would
// then run away. Past the limit the current target — the last point really
// intercepted — is kept.
const PIVOT_FALLBACK_DISTANCE_FACTOR = 3;

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
// pivot — e.g. annotations dimmed to opacity 0.3 after a solo selection, or
// the photoreal shadow catcher (0.15). The ray should pass through and land
// on the geometry (or plane) behind. An annotation's OWN styling opacity
// (fillOpacity 0.75 is a common template default) keeps it a valid orbit
// anchor: the user sees and clicks that face, so the camera must pivot on
// it — not on the base map plane far behind, which made a tall translucent
// wall impossible to orbit around.
const PIVOT_OPACITY_THRESHOLD = 0.5;

// camera-controls `mouseButtons` keys, indexed by PointerEvent.button.
const MOUSE_BUTTON_NAMES = ["left", "middle", "right"];

function isMaterialSeeThrough(material) {
  if (!material) return false;
  if (Array.isArray(material)) return material.some(isMaterialSeeThrough);
  // `transparent: true` alone says nothing about visibility (every
  // translucent annotation and every fat line sets it): only the opacity does.
  return (
    typeof material.opacity === "number" &&
    material.opacity < PIVOT_OPACITY_THRESHOLD
  );
}

// Fat lines (Line2 / LineSegments2 are `isMesh`) are decoration — frame and
// revolution axes, outlines, traits: the pivot ray passes through them and
// lands on the surface behind.
function isPivotCandidate(object) {
  return Boolean(object?.isMesh && !object.isLine2 && !object.isLineSegments2);
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

    // « Caméra ortho » preference (threedEditor.cameraOrtho, via
    // setOrthographic). Applied by _applyProjection — except while suspended
    // (walk mode is perspective only): the swap then waits for the resume.
    this._orthoWanted = false;

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
    // Last wheel event time and the cursor position of the last wheel
    // re-anchoring (see _onWheelCapture).
    this._lastWheelAt = 0;
    this._lastWheelAnchor = { x: NaN, y: NaN };
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
    this._pivotApply = new Vector3();
    this._pivotDir = new Vector3();
    this._pivotRel = new Vector3();
    // Which pass of _computePivotPoint produced the last pivot:
    // "mesh" | "basemap" | "ground" | null.
    this._pivotSource = null;

    // Point grabbed by a pan (TRUCK) gesture, re-applied as the orbit point
    // once the pan has settled — see _onControlEnd / _loop.
    this._panAnchor = new Vector3();
    this._hasPanAnchor = false;
    this._pendingPanAnchor = false;
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
    this.cameraControls.maxDistance = DEFAULT_MAX_DISTANCE;
    this.cameraControls.smoothTime = 0.1; // settle/transition damping (s)
    this.cameraControls.draggingSmoothTime = 0.05; // snappier while dragging
    // Wheel zoom converges toward the point under the cursor.
    this.cameraControls.dollyToCursor = true;
    this._syncOrthoDepthRange();

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
    // Capture phase as well: the orbit point is re-anchored before
    // camera-controls integrates the dolly step.
    this._domElement.addEventListener("wheel", this._onWheelCapture, {
      capture: true,
      passive: true,
    });
    // End of a pointer gesture: a pan hands its grabbed point back as the
    // orbit point (see _onControlEnd).
    this.cameraControls.addEventListener("controlend", this._onControlEnd);

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
    // In orthographic projection the orbit distance is invisible: a DOLLY
    // button zooms the frustum instead (same remap as the wheel, see
    // _applyWheelAndTouches).
    const ortho = this.isOrthographic;
    MOUSE_BUTTON_NAMES.forEach((name) => {
      const action =
        ortho && actions[name] === "DOLLY" ? "ZOOM" : actions[name];
      const want = CameraControls.ACTION[action];
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
    // A new gesture starts from scratch: a pan anchor still pending from the
    // previous one must not be replayed on top of it.
    this._clearPanAnchor();
  };

  // The middle button navigates (dolly / orbit depending on the preset): stop
  // the browser's middle-click auto-scroll from hijacking the drag.
  _onMouseDown = (event) => {
    if (event.button === 1) event.preventDefault();
  };

  // The wheel dolly converges on the cursor (dollyToCursor), but
  // camera-controls slides the target in the screen-parallel plane through
  // the CURRENT target — often the plan behind the object under the cursor —
  // so the camera could dolly through a face long before reaching
  // minDistance (and the near plane then sliced it). Re-anchor the orbit
  // point on the surface under the cursor at the start of each wheel burst,
  // or when the cursor moved, as an orbit pointerdown does: the dolly then
  // stops minDistance short of that surface. The camera never moves here
  // (keepCameraStill), and a burst in progress keeps its pivot: setOrbitPoint
  // on every tick would restart the dolly damping.
  _onWheelCapture = (event) => {
    const now = performance.now();
    const gap = now - this._lastWheelAt;
    this._lastWheelAt = now;
    const moved = Math.hypot(
      event.clientX - this._lastWheelAnchor.x,
      event.clientY - this._lastWheelAnchor.y
    );
    if (gap < WHEEL_BURST_GAP_MS && !(moved > WHEEL_REANCHOR_MOVE_PX)) return;
    if (this._suspended) return;
    // The wheel sets its own pivot: a pan anchor not yet applied is dropped.
    this._clearPanAnchor();
    this._lastWheelAnchor.x = event.clientX;
    this._lastWheelAnchor.y = event.clientY;
    this.updateRotationPivotFromEvent(event, { keepCameraStill: true });
    // Settle the new pose before camera-controls integrates this tick:
    // setOrbitPoint rewrote the orbit radius instantly, and its dolly-to-cursor
    // step measures the dolly as radius - lastDistance (synced only by
    // update()) — the re-anchoring delta would otherwise count as a dolly and
    // throw the target sideways.
    this.cameraControls?.update(0);
  };

  // Navigation action the pressed button starts under the current preset
  // and the modifiers held: "ROTATE" | "TRUCK" | "DOLLY" | "NONE", or null
  // for a button the presets do not map. A touch is treated as an orbit.
  _gestureAction = (event) => {
    if (event.pointerType === "touch") return "ROTATE";
    const name = MOUSE_BUTTON_NAMES[event.button];
    if (!name) return null;
    const actions = resolveNavigationMouseActions(
      this._navigationPreset,
      event
    );
    return actions[name] ?? null;
  };

  // True when the pressed button starts a gesture that should re-anchor the
  // orbit point under the cursor (see updateRotationPivotFromEvent): an orbit,
  // or a pan — whatever its button. Anchoring a pan on the grabbed point
  // keeps that point under the cursor for the whole drag (camera-controls
  // scales the truck with the distance to the target) and, once the pan has
  // settled, hands it back as the orbit point (see _onControlEnd): the next
  // orbit turns around what the user just dragged, not around the previous
  // target translated along.
  isPivotGesture = (event) => {
    const action = this._gestureAction(event);
    return action === "ROTATE" || action === "TRUCK";
  };

  // ----- pan anchor (orbit point after a pan) ---------------------------

  _clearPanAnchor = () => {
    this._hasPanAnchor = false;
    this._pendingPanAnchor = false;
  };

  // camera-controls 'controlend': the pointer gesture is over. A pan that
  // grabbed a point re-anchors the orbit point on it once the truck damping
  // has settled (_loop) — setOrbitPoint must not run mid-transition. The
  // truck moved camera and target by the same delta, so the target now sits
  // where the drag started on screen (a floating point); the grabbed point
  // itself stayed under the cursor and is the natural orbit point.
  _onControlEnd = () => {
    if (this._hasPanAnchor) this._pendingPanAnchor = true;
  };

  _applyPendingPanAnchor = () => {
    if (!this._pendingPanAnchor) return;
    this._pendingPanAnchor = false;
    this._hasPanAnchor = false;
    if (!this.cameraControls?.enabled) return;
    const applied = this._applyOrbitPoint(this._panAnchor);
    if (applied) this.sceneManager.requestRender?.();
  };

  // ----- continuous update loop (render only on change) ----------------

  // Walk mode owns the camera: pause the update loop (rendering included —
  // the walk controller renders). On resume, flush the accumulated clock
  // delta so the suspended time isn't integrated as one huge damping step.
  setSuspended = (suspended) => {
    this._suspended = !!suspended;
    if (!suspended) this._clock.getDelta();
    // Walk mode is perspective only: suspending puts the perspective camera
    // back, resuming re-applies the « Caméra ortho » preference.
    this._applyProjection();
  };

  // ----- projection (« Caméra ortho ») -----------------------------------

  get isOrthographic() {
    return Boolean(this.sceneManager?.camera?.isOrthographicCamera);
  }

  // The perspective camera, whichever camera is active: the fov / far plane
  // bookkeeping of this manager (dolly limits, 2D/3D dolly-zoom) always
  // speaks of it — the orthographic depth range is fixed (SceneManager).
  _perspectiveCamera = () =>
    this.sceneManager?.perspectiveCamera ?? this.sceneManager?.camera;

  _tanHalfFov = () => {
    const persp = this._perspectiveCamera();
    const fovDeg = persp?.getEffectiveFOV?.() ?? persp?.fov ?? 75;
    return Math.tan((fovDeg * Math.PI) / 360);
  };

  // « Caméra ortho » toggle (threedEditor.cameraOrtho, synced by
  // MainThreedEditor). The swap keeps the displayed scale: the orthographic
  // frustum height is the perspective visible height at the orbit distance
  // (h = 2·d·tan(fov/2)) and back.
  setOrthographic = (enabled) => {
    this._orthoWanted = Boolean(enabled);
    this._applyProjection();
  };

  _applyProjection = () => {
    const controls = this.cameraControls;
    const sm = this.sceneManager;
    const persp = sm?.perspectiveCamera;
    const ortho = sm?.orthographicCamera;
    if (!controls || !persp || !ortho) return;
    const wantOrtho = this._orthoWanted && !this._suspended;
    const isOrtho = sm.camera === ortho;
    if (wantOrtho === isOrtho) return;

    // Settle any in-flight transition: the pose read below is the displayed
    // one (camera-controls only writes the camera inside update()).
    controls.update(0);
    if (wantOrtho) {
      const h = 2 * controls.distance * this._tanHalfFov();
      ortho.position.copy(persp.position);
      ortho.quaternion.copy(persp.quaternion);
      ortho.up.copy(persp.up);
      sm.setOrthoVisibleHeight(h);
      // camera-controls tracks the zoom itself and writes it onto its camera
      // at each update: start the orthographic view at zoom 1.
      controls.minZoom = 0.01;
      controls.maxZoom = Infinity;
      controls.zoomTo(1, false);
      controls.camera = ortho;
      this._syncOrthoZoomLimits();
      this._syncOrthoDepthRange();
      sm.setActiveCamera(ortho);
    } else {
      // Visible height of the orthographic view → perspective orbit distance.
      const h = (ortho.top - ortho.bottom) / (ortho.zoom || 1);
      const d = h / (2 * this._tanHalfFov());
      // Reset the tracked zoom BEFORE handing the perspective camera over,
      // or the ortho zoom would be written onto it.
      controls.minZoom = 0.01;
      controls.maxZoom = Infinity;
      controls.zoomTo(1, false);
      ortho.zoom = 1;
      controls.camera = persp;
      controls.dollyTo(
        Math.min(controls.maxDistance, Math.max(controls.minDistance, d)),
        false
      );
      sm.setActiveCamera(persp);
    }
    this._applyMouseButtons({});
    this._applyWheelAndTouches();
    controls.update(0);
    this._syncPerspectiveNear();
    sm.camera.updateMatrixWorld(true);
    sm.requestRender?.();
  };

  // Perspective near plane = NEAR_DISTANCE_RATIO x the orbit distance, within
  // [NEAR_MIN_M, NEAR_MAX_M]: zooming in on a face no longer slices it (the
  // pivot sat on the 0.1 m near plane at minDistance). Runs after every
  // camera-controls update that changed the camera; the orthographic camera
  // keeps its symmetric depth slab (SceneManager.setOrthoDepthRange).
  _syncPerspectiveNear = () => {
    const controls = this.cameraControls;
    const persp = this._perspectiveCamera();
    if (!controls || !persp || this.isOrthographic) return;
    const distance = controls.distance;
    if (!(distance > 0)) return;
    const near = Math.min(
      NEAR_MAX_M,
      Math.max(NEAR_MIN_M, distance * NEAR_DISTANCE_RATIO)
    );
    if (Math.abs(persp.near - near) < 1e-5) return;
    persp.near = near;
    persp.updateProjectionMatrix();
  };

  // Wheel and two-finger gestures: DOLLY (orbit distance) in perspective,
  // ZOOM (frustum) in orthographic — camera-controls picks them from the
  // camera type at construction only.
  _applyWheelAndTouches = () => {
    const controls = this.cameraControls;
    if (!controls) return;
    const ortho = this.isOrthographic;
    const { ACTION } = CameraControls;
    controls.mouseButtons.wheel = ortho ? ACTION.ZOOM : ACTION.DOLLY;
    controls.touches.two = ortho
      ? ACTION.TOUCH_ZOOM_TRUCK
      : ACTION.TOUCH_DOLLY_TRUCK;
  };

  // The dolly limit in force: controls.maxDistance, or the parked one while
  // a transition has lifted it to Infinity.
  _effectiveMaxDistance = () => {
    const controls = this.cameraControls;
    return Number.isFinite(controls?.maxDistance)
      ? controls.maxDistance
      : (this._stashedMaxDistance ?? DEFAULT_MAX_DISTANCE);
  };

  // Orthographic depth range (±half depth around the camera plane) following
  // the perspective far plane (max(default, 2 × maxDistance)): an orbit at
  // the dolly limit then keeps its pivot, and the scene around it, inside the
  // slab. Runs whatever the active camera so the ortho camera is ready for
  // the next toggle.
  _syncOrthoDepthRange = () => {
    const far = this._perspectiveCamera()?.far;
    this.sceneManager?.setOrthoDepthRange?.(far);
  };

  // Orthographic zoom range matching the dolly range of the perspective
  // camera (minDistance / maxDistance, boosts included): zoom = h0 / h where
  // h0 is the frustum base height (top - bottom) and h the visible height.
  _syncOrthoZoomLimits = () => {
    const controls = this.cameraControls;
    const ortho = this.sceneManager?.orthographicCamera;
    if (!controls || !ortho || !this.isOrthographic) return;
    const h0 = ortho.top - ortho.bottom;
    if (!(h0 > 0)) return;
    const tanHalf = this._tanHalfFov();
    const maxD = this._effectiveMaxDistance();
    const minD = Math.max(controls.minDistance, 1e-3);
    controls.minZoom = h0 / (2 * maxD * tanHalf);
    controls.maxZoom = h0 / (2 * minD * tanHalf);
  };

  // Orthographic view only: show `heightM` metres over the viewport height
  // (through camera-controls' tracked zoom, instant). Used by the 2D/3D
  // switch and the framing helpers in place of a dolly.
  setOrthoVisibleHeight = (heightM) => {
    const controls = this.cameraControls;
    const ortho = this.sceneManager?.orthographicCamera;
    if (!controls || !ortho || !this.isOrthographic) return;
    if (!(heightM > 0) || !Number.isFinite(heightM)) return;
    const h0 = ortho.top - ortho.bottom;
    if (!(h0 > 0)) return;
    controls.zoomTo(h0 / heightM, false);
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
      this._syncPerspectiveNear();
      this.sceneManager.renderScene();
    } else {
      // Settled: a pan anchor waiting since 'controlend' can be applied
      // without cutting a transition short.
      this._applyPendingPanAnchor();
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
      this._domElement.removeEventListener("wheel", this._onWheelCapture, {
        capture: true,
      });
      this._domElement = null;
    }
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this.cameraControls) {
      this.cameraControls.removeEventListener("controlend", this._onControlEnd);
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
  // 3D → 2D switch): the boost is then applied there. During the 2D → 3D
  // entry transition (applyPoseAndAnimateFov lifts the limit to Infinity for
  // its duration) the boost goes to the deferred limit the transition hands
  // over at its end — the lifted Infinity must never be read as a base
  // (far = Infinity would break the projection: nothing renders).
  setDistanceBoost = (distance) => {
    const controls = this.cameraControls;
    const camera = this._perspectiveCamera();
    if (!controls || !camera) return;
    this.clearDistanceBoost();
    if (!Number.isFinite(distance) || distance <= 0) return;

    const stashed = this._stashedMaxDistance != null;
    const inTransition = !stashed && controls.maxDistance === Infinity;
    const baseMaxDistance = stashed
      ? this._stashedMaxDistance
      : inTransition
        ? (this._deferredMaxDistance ?? DEFAULT_MAX_DISTANCE)
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
    else if (inTransition) this._deferredMaxDistance = maxDistance;
    else controls.maxDistance = maxDistance;
    if (far !== baseFar) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    this._syncOrthoZoomLimits();
    this._syncOrthoDepthRange();
  };

  // Sets the REGULAR zoom-out range (dolly limit + camera far plane at twice
  // the distance): the "Distance de vue max" setting, or its AUTO value
  // derived from the loaded scan base maps. A boost in progress (base maps
  // grid) is re-applied on top of the new range; a limit parked in the stash
  // (ortho-like fov of the 3D → 2D switch) is updated there.
  setRegularMaxDistance = (distance) => {
    const controls = this.cameraControls;
    const camera = this._perspectiveCamera();
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
    this._syncOrthoZoomLimits();
    this._syncOrthoDepthRange();
    this.sceneManager.requestRender?.();
  };

  // Gives the regular range back. The camera is never pulled in: when it
  // stands beyond the regular limit, the limit stays at its distance (it can
  // still come closer, not go further).
  clearDistanceBoost = () => {
    const boost = this._distanceBoost;
    const controls = this.cameraControls;
    const camera = this._perspectiveCamera();
    if (!boost || !controls || !camera) return;
    this._distanceBoost = null;

    const distance = controls.distance;
    const maxDistance = Math.max(
      boost.baseMaxDistance,
      Number.isFinite(distance) ? distance : 0
    );
    if (this._stashedMaxDistance === boost.maxDistance) {
      this._stashedMaxDistance = maxDistance;
    } else if (this._deferredMaxDistance === boost.maxDistance) {
      this._deferredMaxDistance = maxDistance;
    } else if (controls.maxDistance === boost.maxDistance) {
      controls.maxDistance = maxDistance;
    }
    const far = Math.max(boost.baseFar, 2 * maxDistance);
    if (camera.far === boost.far && far !== camera.far) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    this._syncOrthoZoomLimits();
    this._syncOrthoDepthRange();
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

    // One framing under these exact angles: cameraControls.fitToBox would
    // round them to the nearest axis and pull the camera off an oblique
    // face (a vertical plan at 30°, a slanted mesh face).
    await this.fitToBox3FromAngles({ box, azimuthRad, polarRad });
    return appliedSide;
  };

  // Frame a world-space Box3 from an explicit view direction (azimuth /
  // polar, camera-controls Y-up convention), WITHOUT the nearest-axis
  // snapping of cameraControls.fitToBox (it rounds theta and phi to the
  // closest PI/2 before fitting, so a tilted or shifted view is impossible
  // with it). The box center lands on the screen center; the distance is the
  // smallest one that keeps every corner of the box inside the frustum with
  // `padding` metres of margin. Single smooth transition (setLookAt).
  // Invariant at rest: the orbit target IS the box center (focal offset
  // zeroed), so the following orbit / dolly gestures pivot on what is seen
  // at the screen center — for a base map plane, the center of the image.
  fitToBox3FromAngles = async ({
    box,
    azimuthRad,
    polarRad,
    padding = 0.5,
  }) => {
    const controls = this.cameraControls;
    const camera = this._perspectiveCamera();
    if (!controls || !camera || !box || box.isEmpty()) return;
    if (!Number.isFinite(azimuthRad) || !Number.isFinite(polarRad)) return;

    // Same pole guard as animateToTopDown: camera-controls degenerates at an
    // exactly vertical look direction.
    const polar = Math.min(Math.PI - 0.001, Math.max(0.001, polarRad));
    const dir = new Vector3(
      Math.sin(polar) * Math.sin(azimuthRad),
      Math.cos(polar),
      Math.sin(polar) * Math.cos(azimuthRad)
    ).normalize();

    // Camera basis for that direction (forward = -dir, world up = +Y).
    const forward = dir.clone().negate();
    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-12) right.set(1, 0, 0);
    right.normalize();
    const up = new Vector3().crossVectors(right, forward).normalize();

    const vFovRad = (camera.getEffectiveFOV() * Math.PI) / 180;
    const tanHalfV = Math.tan(vFovRad / 2);
    const tanHalfH = tanHalfV * camera.aspect;

    const center = box.getCenter(new Vector3());
    const corner = new Vector3();
    let distance = 0;
    for (let i = 0; i < 8; i++) {
      corner.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z
      );
      corner.sub(center);
      const depth = corner.dot(dir); // toward the camera
      const x = Math.abs(corner.dot(right)) + padding;
      const y = Math.abs(corner.dot(up)) + padding;
      distance = Math.max(distance, depth + x / tanHalfH, depth + y / tanHalfV);
    }
    if (!Number.isFinite(distance) || distance <= 0) return;

    const position = center.clone().addScaledVector(dir, distance);

    const prevEnabled = controls.enabled;
    try {
      controls.enabled = false; // ignore user input mid-flight
      // A stale focal offset (orbit-around-cursor setOrbitPoint calls) would
      // shift the framed center off the screen center.
      controls.setFocalOffset(0, 0, 0, false);
      await controls.setLookAt(
        position.x,
        position.y,
        position.z,
        center.x,
        center.y,
        center.z,
        true
      );
    } finally {
      controls.enabled = prevEnabled;
    }
    // Orthographic: the distance above frames nothing by itself — show the
    // same visible height as the perspective camera would at that distance.
    if (this.isOrthographic) {
      this.setOrthoVisibleHeight(2 * distance * tanHalfV);
    }
    this.syncCameraNow();
    this.sceneManager.requestRender?.();
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

  // Jump the camera to an explicit pose, no transition. The pose is EXACT
  // (position + look axis): a stale focal offset (left by the
  // orbit-around-cursor setOrbitPoint calls) would be re-applied on top of
  // it as a lateral shift — zero it first, as applyPoseAndAnimateFov does.
  // Used by the walk mode exit to hand the camera back where the walker
  // stands.
  applyPoseInstant = ({ position, target }) => {
    if (!this.cameraControls || !position || !target) return;
    this.cameraControls.setFocalOffset(0, 0, 0, false);
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
    const camera = this._perspectiveCamera();
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
    const camera = this._perspectiveCamera();
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
    const camera = this._perspectiveCamera();
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
      const camera = this._perspectiveCamera();
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

  // Turn the camera, from where it stands, toward `target`: the target lands
  // at the screen centre and becomes the orbit point, the camera position is
  // kept (distance and angles follow). The focal offset (orbit-around-cursor
  // pivots are stored as a screen-parallel offset) is cleared at the same
  // time, otherwise the target would settle off-centre. Smooth transition;
  // resolves when settled. Used by the gizmo hub (« Centrer la vue sur le
  // repère »).
  animateLookAtTarget = async ({ target, smoothTime = 0.3 }) => {
    const controls = this.cameraControls;
    if (!controls || !target) return;

    const prevSmoothTime = controls.smoothTime;
    const prevEnabled = controls.enabled;
    try {
      controls.enabled = false; // ignore user input mid-flight
      controls.smoothTime = smoothTime;
      await Promise.all([
        controls.setFocalOffset(0, 0, 0, true),
        controls.setTarget(target.x, target.y, target.z, true),
      ]);
      // Snap to the exact pose (the transition settles a hair off).
      controls.setFocalOffset(0, 0, 0, false);
      controls.setTarget(target.x, target.y, target.z, false);
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

  // Called on pointerdown (orbit / pan gesture, see isPivotGesture) and at
  // the start of a wheel burst: set the orbit point to the point under the
  // cursor so the gesture orbits around / trucks relative to / dollies toward
  // it. camera-controls' setOrbitPoint preserves the current view (no jump).
  // A fallback-plane hit far from the current view is ignored (the current
  // target is kept — see PIVOT_FALLBACK_DISTANCE_FACTOR). For a pan the
  // applied pivot is remembered as the pan anchor (see _onControlEnd).
  // `options.keepCameraStill`: see _applyOrbitPoint.
  updateRotationPivotFromEvent = (event, options) => {
    if (!this.cameraControls?.enabled) return; // don't fight a gizmo/lasso drag

    const camera = this.sceneManager.camera;
    const dom = this.sceneManager.renderer.domElement;
    if (!camera || !dom) return;

    const rect = dom.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this._pivotNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pivotNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._pivotRaycaster.setFromCamera(this._pivotNdc, camera);
    // Orthographic: setFromCamera starts the ray on the camera plane (NDC
    // z = 0 with the symmetric depth range), so the content displayed behind
    // that plane could never be hit and the pivot fell through to the
    // fallback planes. Start from the near plane instead (near < 0).
    if (camera.isOrthographicCamera) {
      const { ray } = this._pivotRaycaster;
      ray.origin.addScaledVector(ray.direction, camera.near);
    }

    const pivot = this._computePivotPoint();
    if (!pivot) return;
    if (this._pivotSource !== "mesh" && this._isFallbackPivotTooFar(pivot)) {
      return;
    }
    // setOrbitPoint is immediate and must not run during a transition.
    const applied = this._applyOrbitPoint(pivot, options);
    if (applied) this._rememberPanAnchor(event, pivot);
  };

  // Set the orbit point to a known world point (drawing mode: the snap shown
  // under the marker, i.e. the point a click would place). Same guard as
  // updateRotationPivotFromEvent: never fight a gizmo / lasso drag.
  // `options.keepCameraStill`: see _applyOrbitPoint. `options.event`: the
  // pointerdown starting the gesture, so a pan remembers its anchor.
  setRotationPivot = (point, options) => {
    if (!this.cameraControls?.enabled || !point) return;
    const applied = this._applyOrbitPoint(point, options);
    if (applied && options?.event) {
      this._rememberPanAnchor(options.event, point);
    }
  };

  // A pivot that came from a fallback plane (not from geometry) is only
  // trusted close to the current view — see PIVOT_FALLBACK_DISTANCE_FACTOR.
  _isFallbackPivotTooFar = (pivot) => {
    const controls = this.cameraControls;
    const camera = this.sceneManager?.camera;
    if (!controls || !camera) return false;
    const orbitDistance = controls.distance;
    if (!(orbitDistance > 0)) return false;
    return (
      pivot.distanceTo(camera.position) >
      PIVOT_FALLBACK_DISTANCE_FACTOR * orbitDistance
    );
  };

  // The pivot applied at the start of a pan (TRUCK) is the pan anchor,
  // handed back as the orbit point once the pan has settled.
  _rememberPanAnchor = (event, pivot) => {
    if (!event || this._gestureAction(event) !== "TRUCK") return;
    this._panAnchor.copy(pivot);
    this._hasPanAnchor = true;
    this._pendingPanAnchor = false;
  };

  // Hand a pivot to camera-controls. setOrbitPoint keeps the camera where it
  // is only while the pivot distance fits in [minDistance, maxDistance]: past
  // the limit, its dollyTo clamps and the camera is rebuilt closer to the
  // pivot, i.e. moved along its view axis. In perspective that is a visible
  // dolly; in orthographic projection the image does not change at all but
  // the depth slab travels with the camera, and a far fallback-plane hit
  // (the ground seen at a grazing angle) pushed the scene out of the slab
  // gesture after gesture. Every point of the cursor ray projects onto the
  // same pixel in a parallel projection, so the pivot depth is clamped along
  // the view axis instead: the pivot stays under the cursor and the camera
  // never moves. `point` is not mutated.
  // `keepCameraStill` (default): in perspective a pivot outside the dolly
  // range would move the camera — keep the current orbit point instead. No
  // interactive re-anchoring (pointer, wheel, post-drawing pivot, pan
  // anchor) may move the camera. Returns true when the orbit point was set.
  _applyOrbitPoint = (point, { keepCameraStill = true } = {}) => {
    const controls = this.cameraControls;
    const camera = this.sceneManager?.camera;
    if (!controls || !camera) return false;
    const pivot = this._pivotApply.copy(point);
    if (!camera.isOrthographicCamera && keepCameraStill) {
      const distance = pivot.distanceTo(camera.position);
      const maxD = this._effectiveMaxDistance();
      const minD = Math.max(controls.minDistance, 0);
      if (!(distance >= minD && distance <= maxD)) return false;
    }
    if (camera.isOrthographicCamera) {
      const dir = camera.getWorldDirection(this._pivotDir);
      const rel = this._pivotRel.subVectors(pivot, camera.position);
      // Signed depth: a pivot behind the camera plane is a valid orbit point
      // (camera-controls looks at it before applying the focal offset).
      const depth = rel.dot(dir);
      const lateralSq = Math.max(0, rel.lengthSq() - depth * depth);
      const maxD = this._effectiveMaxDistance();
      const minD = Math.max(controls.minDistance, 0);
      // Off-axis beyond the dolly limit: no depth keeps the camera still —
      // keep the current orbit point.
      if (lateralSq >= maxD * maxD) return false;
      const maxDepth = Math.sqrt(maxD * maxD - lateralSq);
      const minDepth =
        lateralSq < minD * minD ? Math.sqrt(minD * minD - lateralSq) : 0;
      const sign = depth < 0 ? -1 : 1;
      const clamped =
        sign * Math.min(maxDepth, Math.max(minDepth, Math.abs(depth)));
      if (clamped !== depth) pivot.addScaledVector(dir, clamped - depth);
    }
    controls.setOrbitPoint(pivot.x, pivot.y, pivot.z);
    return true;
  };

  // Resolve the world point under the cursor, in priority order:
  //   (a) the nearest opaque mesh hit (see-through meshes are ignored so a
  //       dimmed annotation never captures the pivot),
  //   (b) the nearest basemap plane (infinite — robust even if the basemap
  //       image isn't drawn or is too small),
  //   (c) the ground plane y=0.
  // The ray is the one set by updateRotationPivotFromEvent (in orthographic
  // projection it starts on the near plane, so the whole displayed slab is
  // pickable). A far plane hit is dropped by updateRotationPivotFromEvent
  // (PIVOT_FALLBACK_DISTANCE_FACTOR) and, in orthographic projection, tamed
  // by _applyOrbitPoint. The pass that produced the point is recorded in
  // this._pivotSource ("mesh" | "basemap" | "ground").
  // Returns a Vector3 (this._pivotBest) or null.
  _computePivotPoint = () => {
    const ray = this._pivotRaycaster;
    this._pivotSource = null;

    // (a) Meshes first.
    const scene = this.sceneManager.scene;
    if (scene) {
      const intersects = ray.intersectObjects(scene.children, true);
      for (const i of intersects) {
        if (
          isPivotCandidate(i.object) &&
          // three's raycaster ignores `visible`: a hidden object (a face
          // hidden with « Masquer l'annotation », annotations switched off)
          // must not catch the orbit point.
          isObjectChainVisible(i.object) &&
          !isMaterialSeeThrough(i.object.material)
        ) {
          this._pivotSource = "mesh";
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
    if (found) {
      this._pivotSource = "basemap";
      return this._pivotBest;
    }

    // (c) Ground plane y=0.
    this._pivotPlane.setFromNormalAndCoplanarPoint(
      this._pivotPlaneNormal.set(0, 1, 0),
      this._pivotHit.set(0, 0, 0)
    );
    const ground = ray.ray.intersectPlane(this._pivotPlane, this._pivotHit);
    if (!ground) return null;
    this._pivotSource = "ground";
    return this._pivotBest.copy(ground);
  };
}
