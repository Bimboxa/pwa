import { MathUtils, Vector3 } from "three";

// First-person walk controller for the 3D editor (P key, see
// walkModeToggle). While active it owns the camera: camera-controls is
// disabled AND its update loop suspended (update() rewrites the camera pose
// every call, even when disabled — see ControlsManager.setSuspended).
//
// Inputs (letters matched on e.key so the printed key works on AZERTY):
// - pointer-locked mouse looks around; Q / S also turn the gaze left / right
//   while held;
// - arrows move (Up/Down forward/back, Left/Right strafe); Z / W move the
//   eye up / down while held and the reached altitude persists (gravity then
//   glides back to THAT altitude, not to the walking eye height);
// - R held = run (movement x RUN_MULTIPLIER);
// - Space = primary action of the current tool (onPrimaryStart on press,
//   onPrimaryStop on release / blur / exit): the lance streams while held,
//   the measure tool shoots on press;
// - O switches the tool (onSwitchTool), Backspace / Delete clears the
//   current tool's traces (onClear);
// - B cycles the nozzle shape (onCycleJetMode), + / - widen / narrow the
//   nozzle aperture (onSprayWiden / onSprayNarrow, key-repeat sweeps);
// - V cycles the scans display (onCycleScanMode: hidden / points / realistic).
// - C toggles "free climb" (onToggleFreeClimb): obstacles stop blocking and
//   the ground becomes the highest surface at the walker's (x, z).
//
// Movement model (user-validated):
// - entry leaves the camera exactly where the orbit view had it (position
//   AND gaze): the walker hovers "airborne" until the first arrow press,
//   which drops it (eased descent, gaze untouched) onto the floor below —
//   the highest surface under the camera (scene geometry, scan relief,
//   selected baseMap plane), else world altitude 0. Z / W meanwhile fly
//   freely (no gravity, no drop); the gaze turns as usual;
// - eye at groundY + EYE_HEIGHT (+ the Z/W altitude offset) above the
//   ground. The ground is the highest of: the selected baseMap plane, the
//   scan relief under the camera (sampleGroundY, height map of a scan base
//   map) and the scene geometry under the camera (collisionProbe: base map
//   planes, annotation solids, mailles). With the step constraint on, only
//   the geometry below the feet + MAX_STEP counts (slabs, steps): a wall top
//   is not a floor. With free climb (C) the highest surface wins whatever
//   its height — on the walls, on the roofs (and, under a roof, up onto it);
// - obstacles: with the step constraint on, horizontal moves are probed in
//   the body band (BODY_HEIGHTS above the feet, BODY_RADIUS ahead) and
//   stopped at the obstacle, the remainder sliding along it. Free climb
//   disables the probe;
// - |pitch| > CLIMB_PITCH: forward/back follow the full look vector (climb
//   when looking up, descend when looking down) — the vertical part is never
//   constrained;
// - |pitch| <= CLIMB_PITCH: movement is horizontal and gravity glides the
//   eye back to its reference height.

const EYE_HEIGHT = 1.7; // m above the baseMap plane
const MAX_STEP = 0.4; // m, highest step / slab climbed without free climb
const BODY_RADIUS = 0.3; // m, kept between the camera and an obstacle
const GROUND_EPS = 0.01; // m, ground ray origin above the step height
// Body band probed ahead, in m above the feet: from just above the step
// height to just above the eyes, every 0.25 m (no blind gap for a thin slab
// at mid height). A gentle mesh ramp stays walkable (the lowest ray reaches
// the slope beyond its range) while a steep one blocks.
const BODY_HEIGHTS = [0.45, 0.7, 0.95, 1.2, 1.45, 1.7, 1.85];
const SPEED = 4; // m/s
const RUN_MULTIPLIER = 3; // R held
const TURN_SPEED = MathUtils.degToRad(90); // rad/s, Q / S held
const VERTICAL_SPEED = 2; // m/s, Z / W held
const SENSITIVITY = 0.0025; // rad per px of pointer-locked mouse move
const PITCH_LIMIT = MathUtils.degToRad(89);
const CLIMB_PITCH = MathUtils.degToRad(45);
const GRAVITY_RATE = 5; // 1/s, exponential glide back to eye height
const EXIT_TARGET_DIST = 5; // m, orbit target handed back on exit
const MIN_HEAD_CLEARANCE = 0.3; // m, floor clamp while descending

// Drop animation (first arrow press): the camera descends from its hovering
// pose onto the walking eye height. Duration scales with the drop height so
// short hops don't drag and long dives don't snap.
const LANDING_MS_PER_M = 60;
const LANDING_MS_MIN = 500;
const LANDING_MS_MAX = 1500;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const emptyKeys = () => ({
  fwd: false,
  back: false,
  left: false,
  right: false,
  turnLeft: false,
  turnRight: false,
  up: false,
  down: false,
  run: false,
});

// Held-key letters (e.key, lower-cased). AZERTY-friendly: Q/S sit under the
// left hand, Z (top row) goes up, W (bottom row) goes down.
const LETTER_KEYS = {
  q: "turnLeft",
  s: "turnRight",
  z: "up",
  w: "down",
  r: "run",
};

const _dir = new Vector3();
const _delta = new Vector3();
const _step = new Vector3();
const _rest = new Vector3();

export default class WalkModeController {
  constructor({
    sceneManager,
    groundY = 0,
    sampleGroundY = null,
    collisionProbe = null,
    onRequestExit,
    onPrimaryStart,
    onPrimaryStop,
    onSwitchTool,
    onClear,
    onCycleJetMode,
    onSprayWiden,
    onSprayNarrow,
    onToggleFreeClimb,
    onCycleScanMode,
  }) {
    this.sceneManager = sceneManager;
    // Plane ground (fallback) and the live ground under the camera.
    this._baseGroundY = groundY;
    this._sampleGroundY = sampleGroundY;
    // Scene geometry probe (walkCollisionProbe): ground + obstacles.
    this._collisionProbe = collisionProbe;
    this.groundY = groundY;
    this.onRequestExit = onRequestExit;
    this.onPrimaryStart = onPrimaryStart;
    this.onPrimaryStop = onPrimaryStop;
    this.onSwitchTool = onSwitchTool;
    this.onClear = onClear;
    this.onCycleJetMode = onCycleJetMode;
    this.onSprayWiden = onSprayWiden;
    this.onSprayNarrow = onSprayNarrow;
    this.onToggleFreeClimb = onToggleFreeClimb;
    this.onCycleScanMode = onCycleScanMode;

    this._yaw = 0;
    this._pitch = 0;
    this._lookDirty = false;
    this._keys = emptyKeys();
    // C: no obstacle blocks and the ground is the highest surface at (x, z).
    this._freeClimb = false;
    // Altitude gained with Z / W, in meters above the walking eye height.
    // Gravity targets groundY + EYE_HEIGHT + this offset (see _refEyeY).
    this._altitudeOffset = 0;
    this._locked = false;
    this._hasLockedOnce = false;
    this._rafId = null;
    this._lastT = 0;
    this._prevRotationOrder = null;

    // Hovering at the entry pose until the first arrow press (see _tick).
    this._airborne = false;
    // Drop animation state (see _startDrop / _tick).
    this._landing = false;
    this._landingT0 = 0;
    this._landingMs = 0;
    this._landingFromY = 0;
  }

  setGroundY = (y) => {
    this._baseGroundY = Number.isFinite(y) ? y : 0;
    this._updateGround();
  };

  // (x, z) → world ground Y | null (see createScene3dGroundSampler).
  setGroundSampler = (fn) => {
    this._sampleGroundY = typeof fn === "function" ? fn : null;
    this._updateGround();
  };

  // Ground under the camera: the highest of the plane, the scan relief and
  // the scene geometry (walkable part only unless free climb, see header).
  _updateGround = () => {
    const camera = this.sceneManager?.camera;
    if (!camera) {
      this.groundY = this._baseGroundY;
      return;
    }
    const { x, y, z } = camera.position;
    const feet = y - EYE_HEIGHT;
    let groundY = this._baseGroundY;

    const scanY = this._sampleGroundY?.(x, z);
    if (Number.isFinite(scanY)) groundY = Math.max(groundY, scanY);

    const probe = this._collisionProbe;
    if (probe) {
      const probeY = this._freeClimb
        ? probe.sampleGroundY(x, z, probe.getBounds().max.y + 1, {
            // An upper level's plan over the head is not a floor.
            skipBasemapsAbove: feet + EYE_HEIGHT,
          })
        : probe.sampleGroundY(x, z, feet + MAX_STEP + GROUND_EPS);
      if (Number.isFinite(probeY)) groundY = Math.max(groundY, probeY);
    }

    this.groundY = groundY;
  };

  // Floor the airborne walker drops onto: the highest surface BELOW the
  // camera among the scene geometry (base map planes, solids, mailles — no
  // step limit, the camera may hang far above), the scan relief and the
  // selected plane; world altitude 0 when nothing lies below.
  _dropFloorY = () => {
    const { x, y, z } = this.sceneManager.camera.position;
    let floorY = null;
    const consider = (v) => {
      if (!Number.isFinite(v) || v > y) return;
      floorY = floorY === null ? v : Math.max(floorY, v);
    };
    consider(this._baseGroundY);
    consider(this._sampleGroundY?.(x, z));
    consider(this._collisionProbe?.sampleGroundY(x, z, y));
    return floorY ?? 0;
  };

  // First arrow press while airborne: drop onto the floor below (eased
  // descent, gaze untouched); walking resumes on touchdown.
  _startDrop = (now) => {
    const camera = this.sceneManager.camera;
    const floorY = this._dropFloorY();
    // A selected plane hanging above the landing floor must not pull the
    // walker back up afterwards (it is the lower bound of _updateGround).
    this._baseGroundY = Math.min(this._baseGroundY, floorY);
    this.groundY = floorY;
    this._altitudeOffset = 0;
    this._landingFromY = camera.position.y;
    this._landingMs = MathUtils.clamp(
      Math.abs(this._refEyeY() - camera.position.y) * LANDING_MS_PER_M,
      LANDING_MS_MIN,
      LANDING_MS_MAX
    );
    this._landingT0 = now;
    this._landing = true;
    this._airborne = false;
  };

  // Horizontal move of `delta` (y ignored) stopped at the first obstacle of
  // the body band, the remainder sliding along it (one slide pass: a corner
  // resolves to a stop). Free climb / no probe: the move is applied as is.
  // → true when the camera moved.
  _moveHorizontal = (delta) => {
    const camera = this.sceneManager.camera;
    const len = Math.hypot(delta.x, delta.z);
    if (len < 1e-6) return false;
    const probe = this._collisionProbe;
    if (this._freeClimb || !probe) {
      camera.position.x += delta.x;
      camera.position.z += delta.z;
      return true;
    }

    const feetY = camera.position.y - EYE_HEIGHT;
    const probeArgs = {
      origin: camera.position,
      feetY,
      radius: BODY_RADIUS,
      heights: BODY_HEIGHTS,
    };

    _dir.set(delta.x / len, 0, delta.z / len);
    const hit = probe.probeBody({ ...probeArgs, dir: _dir, length: len });
    const allowed = hit ? Math.max(0, hit.distance - BODY_RADIUS) : len;
    _step.copy(_dir).multiplyScalar(allowed);
    camera.position.x += _step.x;
    camera.position.z += _step.z;
    let moved = allowed > 1e-6;
    if (!hit) return moved;

    // Remainder projected on the obstacle's plane, probed once more.
    _rest.set(delta.x - _step.x, 0, delta.z - _step.z);
    const n = hit.normal;
    _rest.addScaledVector(n, -_rest.dot(n));
    const slideLen = Math.hypot(_rest.x, _rest.z);
    if (slideLen < 1e-6) return moved;
    _dir.set(_rest.x / slideLen, 0, _rest.z / slideLen);
    const hit2 = probe.probeBody({
      ...probeArgs,
      dir: _dir,
      length: slideLen,
    });
    const slideAllowed = hit2
      ? Math.min(slideLen, Math.max(0, hit2.distance - BODY_RADIUS))
      : slideLen;
    if (slideAllowed > 1e-6) {
      camera.position.x += _dir.x * slideAllowed;
      camera.position.z += _dir.z * slideAllowed;
      moved = true;
    }
    return moved;
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

    // The camera stays put (position and gaze): the walker hovers until the
    // first arrow press drops it onto the floor below (_startDrop).
    this._keys = emptyKeys();
    this._altitudeOffset = 0;
    this._airborne = true;
    this._landing = false;

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
    // Fallback: the initial requestPointerLock (issued by the toggle
    // keydown / click handler, see walkModeToggle) may fail or the user may
    // Escape out of the lock — a click on the canvas re-acquires it.
    dom.addEventListener("click", this._onCanvasClick);

    this._lastT = performance.now();
    this._rafId = requestAnimationFrame(this._tick);
    this._render();
  };

  exit = () => {
    this.onPrimaryStop?.(); // never leave a stream running past the mode
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

  // Reference eye height gravity glides back to: walking height plus the
  // altitude gained with Z / W.
  _refEyeY = () => this.groundY + EYE_HEIGHT + this._altitudeOffset;

  // ----- keyboard ----------------------------------------------------------

  // Held keys: arrows (movement) + letters (turn / altitude / run). Letters
  // only ARM on a bare keypress (modifier chords such as Cmd+S / Ctrl+Z stay
  // untouched) but always RELEASE, so a modifier pressed mid-hold cannot
  // leave a key stuck.
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
      default: {
        const name = LETTER_KEYS[e.key?.toLowerCase?.()];
        if (!name) return false;
        if (down && (e.ctrlKey || e.metaKey || e.altKey)) return false;
        this._keys[name] = down;
        return true;
      }
    }
  };

  _onKeyDown = (e) => {
    // Lock never acquired (denied / errored): Escape still exits walk mode.
    if (e.key === "Escape" && !this._locked) {
      this.onRequestExit?.();
      return;
    }
    if (e.code === "Space") {
      // Primary action: held key = continuous jet (lance), single press =
      // shot (measure); released in _onKeyUp.
      if (!e.repeat) this.onPrimaryStart?.();
      // Space would scroll the page or "click" a focused button.
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      // Wipe the current tool's traces (paint splats / measures).
      if (!e.repeat) this.onClear?.();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    // Single-press letters. e.key (not e.code) so the printed key matches on
    // AZERTY layouts; modifier chords (Cmd+B bold, Cmd+- zoom...) stay
    // untouched.
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "o") {
        if (!e.repeat) this.onSwitchTool?.();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (key === "b") {
        if (!e.repeat) this.onCycleJetMode?.();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (key === "v") {
        // « Vue 3D » of the scans: hidden → points → realistic.
        if (!e.repeat) this.onCycleScanMode?.();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (key === "c") {
        // Free climb: obstacles stop blocking, the ground is the highest
        // surface under the walker (re-read right away: gravity then glides
        // the eye onto it).
        if (!e.repeat) {
          this._freeClimb = !this._freeClimb;
          this.onToggleFreeClimb?.(this._freeClimb);
          this._updateGround();
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      // Nozzle aperture: repeat allowed, holding the key sweeps the angle.
      // "=" is the unshifted "+" key on most layouts.
      if (key === "+" || key === "=" || key === "-") {
        (key === "-" ? this.onSprayNarrow : this.onSprayWiden)?.();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
    if (this._setKeyFromEvent(e, true)) {
      // Held keys must not scroll the page nor reach other shortcuts.
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  _onKeyUp = (e) => {
    if (e.code === "Space") {
      this.onPrimaryStop?.();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (this._setKeyFromEvent(e, false)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  _onBlur = () => {
    // Focus loss eats the keyup events — don't keep walking (or spraying)
    // forever.
    this._keys = emptyKeys();
    this.onPrimaryStop?.();
  };

  // ----- movement loop -------------------------------------------------------

  _tick = (now) => {
    this._rafId = requestAnimationFrame(this._tick);
    // Clamp tab-switch gaps to avoid teleporting on the first frame back.
    const dt = Math.min((now - this._lastT) / 1000, 0.1);
    this._lastT = now;

    const camera = this.sceneManager.camera;
    let moved = false;

    const keys = this._keys;
    const runMul = keys.run ? RUN_MULTIPLIER : 1;
    const fwdSign = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0);
    const strafeSign = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const turnSign = (keys.turnLeft ? 1 : 0) - (keys.turnRight ? 1 : 0);
    const vertSign = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);

    if (turnSign) {
      // Same sign convention as the mouse: yaw grows when turning left.
      this._yaw += turnSign * TURN_SPEED * dt;
      this._lookDirty = true;
    }

    if (this._landing) {
      // Drop: eased vertical descent onto the walking eye height, the gaze
      // free (mouse / Q / S). Movement keys wait for touchdown.
      const p = Math.min((now - this._landingT0) / this._landingMs, 1);
      camera.position.y = MathUtils.lerp(
        this._landingFromY,
        this._refEyeY(),
        easeInOutCubic(p)
      );
      if (this._lookDirty) {
        this._applyLook();
        this._lookDirty = false;
      }
      if (p >= 1) this._landing = false;
      this._renderTick(true);
      return;
    }

    // Scene changes mid-walk (rebuilt annotations, loaded textures / GLBs)
    // reach the probe within a second.
    this._collisionProbe?.maybeRefresh(now);

    if (this._airborne) {
      // Hovering at the entry pose: the first arrow press drops the walker
      // onto the floor below; until then Z / W fly freely (no gravity, no
      // floor clamp) and the gaze turns.
      if (fwdSign || strafeSign) {
        this._startDrop(now);
        this._renderTick(true);
        return;
      }
      if (vertSign) {
        camera.position.y += vertSign * VERTICAL_SPEED * runMul * dt;
        moved = true;
      }
      if (this._lookDirty) {
        this._applyLook();
        this._lookDirty = false;
        moved = true;
      }
      this._renderTick(moved);
      return;
    }

    const speed = SPEED * runMul;
    const climbing = Math.abs(this._pitch) > CLIMB_PITCH;

    if (fwdSign || strafeSign) {
      // One horizontal delta for forward/back + strafe (a diagonal move is
      // probed once), the vertical part of a climb kept aside: obstacles
      // only constrain the horizontal travel.
      const travel = speed * dt;
      const sinYaw = Math.sin(this._yaw);
      const cosYaw = Math.cos(this._yaw);
      // Forward along the look vector when climbing (its horizontal part
      // shrinks with the pitch), along the horizon otherwise.
      const fwdScale = climbing ? Math.cos(this._pitch) : 1;
      _delta.set(
        (-sinYaw * fwdScale * fwdSign + cosYaw * strafeSign) * travel,
        0,
        (-cosYaw * fwdScale * fwdSign - sinYaw * strafeSign) * travel
      );
      if (this._moveHorizontal(_delta)) moved = true;
      if (climbing && fwdSign) {
        // Climb when looking up, descend when looking down.
        camera.position.y += Math.sin(this._pitch) * fwdSign * travel;
        moved = true;
      }
    }

    if (vertSign) {
      // Z / W: vertical flight; the reached altitude becomes the new
      // reference height gravity glides back to.
      camera.position.y += vertSign * VERTICAL_SPEED * runMul * dt;
      camera.position.y = Math.max(
        camera.position.y,
        this.groundY + MIN_HEAD_CLEARANCE
      );
      this._altitudeOffset = camera.position.y - (this.groundY + EYE_HEIGHT);
      moved = true;
    }

    // Relief under the (possibly moved) camera before gravity and the floor
    // clamp read it.
    this._updateGround();

    const eyeY = this._refEyeY();
    if (!climbing && !vertSign && Math.abs(camera.position.y - eyeY) > 1e-4) {
      // Gravity: frame-rate-independent exponential glide back to the
      // reference height.
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
