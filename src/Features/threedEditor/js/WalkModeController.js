import { MathUtils, Vector3 } from "three";

// First-person walk controller for the 3D editor (W key). While active it
// owns the camera: camera-controls is disabled AND its update loop suspended
// (update() rewrites the camera pose every call, even when disabled — see
// ControlsManager.setSuspended). Pointer-locked mouse looks around, arrow
// keys move, Space fires (delegated to `onFire`).
//
// Movement model (user-validated):
// - eye at groundY + EYE_HEIGHT above the selected baseMap plane;
// - Up/Down arrows = forward/back, Left/Right = horizontal strafe;
// - |pitch| > CLIMB_PITCH: forward/back follow the full look vector (climb
//   when looking up, descend when looking down);
// - |pitch| <= CLIMB_PITCH: movement is horizontal and gravity glides the
//   eye back to its walking height.

const EYE_HEIGHT = 1.7; // m above the baseMap plane
const SPEED = 3; // m/s
const SENSITIVITY = 0.0025; // rad per px of pointer-locked mouse move
const PITCH_LIMIT = MathUtils.degToRad(89);
const CLIMB_PITCH = MathUtils.degToRad(45);
const GRAVITY_RATE = 5; // 1/s, exponential glide back to eye height
const EXIT_TARGET_DIST = 5; // m, orbit target handed back on exit
const MIN_HEAD_CLEARANCE = 0.3; // m, floor clamp while descending

// Entry "landing" animation: the camera descends from its orbit pose onto
// the walking eye height while the gaze levels out to the horizon. Duration
// scales with the drop height so short hops don't drag and long dives don't
// snap.
const LANDING_MS_PER_M = 60;
const LANDING_MS_MIN = 500;
const LANDING_MS_MAX = 1500;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const _dir = new Vector3();

export default class WalkModeController {
  constructor({ sceneManager, groundY = 0, onRequestExit, onFire }) {
    this.sceneManager = sceneManager;
    this.groundY = groundY;
    this.onRequestExit = onRequestExit;
    this.onFire = onFire;

    this._yaw = 0;
    this._pitch = 0;
    this._lookDirty = false;
    this._keys = { fwd: false, back: false, left: false, right: false };
    this._locked = false;
    this._hasLockedOnce = false;
    this._rafId = null;
    this._lastT = 0;
    this._prevRotationOrder = null;

    // Landing animation state (see _tick).
    this._landing = false;
    this._landingT0 = 0;
    this._landingMs = 0;
    this._landingFromY = 0;
    this._landingFromPitch = 0;
  }

  setGroundY = (y) => {
    this.groundY = Number.isFinite(y) ? y : 0;
  };

  enter = () => {
    const sm = this.sceneManager;
    const cm = sm.controlsManager;
    const camera = sm.camera;
    const dom = sm.renderer.domElement;

    // Settle any in-flight camera-controls transition before reading the pose.
    cm.syncCameraNow();

    // Seed yaw/pitch from the current look direction. With rotation order
    // "YXZ" and rotation (pitch, yaw, 0), forward (camera -Z) is
    // (-sin(yaw)cos(pitch), sin(pitch), -cos(yaw)cos(pitch)).
    const fwd = camera.getWorldDirection(new Vector3());
    this._yaw = Math.atan2(-fwd.x, -fwd.z);
    this._pitch = MathUtils.clamp(
      Math.asin(MathUtils.clamp(fwd.y, -1, 1)),
      -PITCH_LIMIT,
      PITCH_LIMIT
    );

    // Land onto the ground plane (keep x/z): animate the descent to walking
    // eye height while the gaze levels out to the horizon.
    const eyeY = this.groundY + EYE_HEIGHT;
    this._landingFromY = camera.position.y;
    this._landingFromPitch = this._pitch;
    this._landingMs = MathUtils.clamp(
      Math.abs(eyeY - camera.position.y) * LANDING_MS_PER_M,
      LANDING_MS_MIN,
      LANDING_MS_MAX
    );
    this._landingT0 = performance.now();
    this._landing = true;

    this._prevRotationOrder = camera.rotation.order;
    camera.rotation.order = "YXZ";
    this._applyLook();

    // Take the camera over: no input processing AND no per-frame pose
    // overwrite from camera-controls' update loop.
    cm.orbitControls.enabled = false;
    cm.setSuspended(true);

    document.addEventListener("pointerlockchange", this._onLockChange);
    document.addEventListener("pointerlockerror", this._onLockError);
    document.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("keydown", this._onKeyDown, true);
    window.addEventListener("keyup", this._onKeyUp, true);
    window.addEventListener("blur", this._onBlur);
    // Fallback: the initial requestPointerLock (issued by the W-keydown
    // handler) may fail or the user may Escape out of the lock — a click on
    // the canvas re-acquires it.
    dom.addEventListener("click", this._onCanvasClick);

    this._lastT = performance.now();
    this._rafId = requestAnimationFrame(this._tick);
    this._render();
  };

  exit = () => {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    const sm = this.sceneManager;
    const dom = sm.renderer.domElement;

    // Remove listeners BEFORE exiting the pointer lock: the resulting
    // pointerlockchange must not re-trigger onRequestExit.
    document.removeEventListener("pointerlockchange", this._onLockChange);
    document.removeEventListener("pointerlockerror", this._onLockError);
    document.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("keydown", this._onKeyDown, true);
    window.removeEventListener("keyup", this._onKeyUp, true);
    window.removeEventListener("blur", this._onBlur);
    dom.removeEventListener("click", this._onCanvasClick);

    if (document.pointerLockElement === dom) document.exitPointerLock();

    const camera = sm.camera;

    // Restore the euler order WITHOUT moving the camera: three.js's Euler
    // `order` setter recomputes the quaternion from the SAME angles in the
    // new order, which would corrupt the orientation (and the exit target
    // derived from it) — the camera would visibly jump. Re-express the
    // current quaternion in the restored order instead.
    const orientation = camera.quaternion.clone();
    camera.rotation.order = this._prevRotationOrder ?? "XYZ";
    camera.quaternion.copy(orientation);

    // Hand the pose back to camera-controls: same position, orbit target a
    // few meters ahead along the look direction (pitch is clamped away from
    // the poles, so the spherical decomposition is safe). setLookAt rebuilds
    // the exact same orientation (position -> target, +Y up, no roll), so
    // the switch back to orbit is seamless.
    const fwd = camera.getWorldDirection(new Vector3());
    const target = camera.position
      .clone()
      .addScaledVector(fwd, EXIT_TARGET_DIST);
    const cm = sm.controlsManager;
    cm.applyPoseInstant({ position: camera.position, target });
    cm.setSuspended(false);
    cm.orbitControls.enabled = true;
    cm.syncCameraNow();
    sm.renderScene();
  };

  // ----- pointer lock ----------------------------------------------------

  _onLockChange = () => {
    const dom = this.sceneManager.renderer.domElement;
    this._locked = document.pointerLockElement === dom;
    if (this._locked) this._hasLockedOnce = true;
    // Escape (or any native unlock) after a successful lock exits walk mode.
    else if (this._hasLockedOnce) this.onRequestExit?.();
  };

  _onLockError = () => {
    // Stay in walk mode; the click-to-lock fallback re-acquires the lock.
    this._locked = false;
  };

  _onCanvasClick = () => {
    if (this._locked) return;
    this.sceneManager.renderer.domElement.requestPointerLock?.();
  };

  // ----- look ---------------------------------------------------------------

  _onPointerMove = (e) => {
    if (!this._locked) return;
    // The landing animation owns the gaze — mouse look resumes on touchdown.
    if (this._landing) return;
    this._yaw -= e.movementX * SENSITIVITY;
    this._pitch = MathUtils.clamp(
      this._pitch - e.movementY * SENSITIVITY,
      -PITCH_LIMIT,
      PITCH_LIMIT
    );
    this._lookDirty = true;
  };

  _applyLook = () => {
    this.sceneManager.camera.rotation.set(this._pitch, this._yaw, 0);
  };

  // ----- keyboard ----------------------------------------------------------

  _setKeyFromEvent = (e, down) => {
    switch (e.key) {
      case "ArrowUp":
        this._keys.fwd = down;
        return true;
      case "ArrowDown":
        this._keys.back = down;
        return true;
      case "ArrowLeft":
        this._keys.left = down;
        return true;
      case "ArrowRight":
        this._keys.right = down;
        return true;
      default:
        return false;
    }
  };

  _onKeyDown = (e) => {
    // Lock never acquired (denied / errored): Escape still exits walk mode.
    if (e.key === "Escape" && !this._locked) {
      this.onRequestExit?.();
      return;
    }
    if (e.code === "Space") {
      if (!e.repeat) this.onFire?.();
      // Space would scroll the page or "click" a focused button.
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (this._setKeyFromEvent(e, true)) {
      // Arrows must not scroll the page nor reach other shortcuts.
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  _onKeyUp = (e) => {
    if (this._setKeyFromEvent(e, false)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  _onBlur = () => {
    // Focus loss eats the keyup events — don't keep walking forever.
    this._keys = { fwd: false, back: false, left: false, right: false };
  };

  // ----- movement loop -------------------------------------------------------

  _tick = (now) => {
    this._rafId = requestAnimationFrame(this._tick);
    // Clamp tab-switch gaps to avoid teleporting on the first frame back.
    const dt = Math.min((now - this._lastT) / 1000, 0.1);
    this._lastT = now;

    const camera = this.sceneManager.camera;
    let moved = false;

    if (this._landing) {
      // Entry animation: eased vertical descent onto the walking eye height,
      // gaze leveling out to the horizon. Movement keys wait for touchdown.
      const p = Math.min((now - this._landingT0) / this._landingMs, 1);
      const eased = easeInOutCubic(p);
      const eyeY = this.groundY + EYE_HEIGHT;
      camera.position.y = MathUtils.lerp(this._landingFromY, eyeY, eased);
      this._pitch = MathUtils.lerp(this._landingFromPitch, 0, eased);
      this._applyLook();
      this._lookDirty = false;
      if (p >= 1) this._landing = false;
      this._renderTick(true);
      return;
    }

    const fwdSign = (this._keys.fwd ? 1 : 0) - (this._keys.back ? 1 : 0);
    const strafeSign = (this._keys.right ? 1 : 0) - (this._keys.left ? 1 : 0);
    const climbing = Math.abs(this._pitch) > CLIMB_PITCH;

    if (fwdSign) {
      if (climbing) {
        // Full look vector: climb when looking up, descend when looking down.
        _dir.set(
          -Math.sin(this._yaw) * Math.cos(this._pitch),
          Math.sin(this._pitch),
          -Math.cos(this._yaw) * Math.cos(this._pitch)
        );
      } else {
        _dir.set(-Math.sin(this._yaw), 0, -Math.cos(this._yaw));
      }
      camera.position.addScaledVector(_dir, fwdSign * SPEED * dt);
      moved = true;
    }

    if (strafeSign) {
      // Lateral strafe is always horizontal.
      camera.position.x += Math.cos(this._yaw) * strafeSign * SPEED * dt;
      camera.position.z += -Math.sin(this._yaw) * strafeSign * SPEED * dt;
      moved = true;
    }

    const eyeY = this.groundY + EYE_HEIGHT;
    if (!climbing && Math.abs(camera.position.y - eyeY) > 1e-4) {
      // Gravity: frame-rate-independent exponential glide back to eye height.
      camera.position.y +=
        (eyeY - camera.position.y) * (1 - Math.exp(-GRAVITY_RATE * dt));
      moved = true;
    }

    // Never sink through the floor while descending along the look vector.
    if (camera.position.y < this.groundY + MIN_HEAD_CLEARANCE) {
      camera.position.y = this.groundY + MIN_HEAD_CLEARANCE;
      moved = true;
    }

    if (this._lookDirty) {
      this._applyLook();
      this._lookDirty = false;
      moved = true;
    }

    this._renderTick(moved);
  };

  // Same render policy as ControlsManager._loop: render on-demand only.
  _renderTick = (moved) => {
    if (moved) this.sceneManager.renderScene();
  };

  _render = () => {
    this.sceneManager.renderScene();
  };
}
