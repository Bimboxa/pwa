import { Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const PAN_DURATION_MS = 600;

// easeInOutCubic — cheap, smooth, no overshoot.
function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default class ControlsManager {
  constructor({sceneManager}) {
    this.sceneManager = sceneManager;
    this.orbitControls = null;

    this._tweenRafId = null;
    this._cancelTween = null;
  }

  initControls = () => {
    this.orbitControls = new OrbitControls(
      this.sceneManager.camera,
      this.sceneManager.renderer.domElement
    );
    this.orbitControls.addEventListener(
      "change",
      this.sceneManager.renderScene
    ); // call this only in static scenes (i.e., if there is no animation loop)

    this.orbitControls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.screenSpacePanning = false;
    this.orbitControls.minDistance = 0.1;
    this.orbitControls.maxDistance = 500;

    // Manual interaction always wins: any orbit/zoom/pan gesture aborts an
    // in-flight pan tween so the user is never fighting the animation.
    this.orbitControls.addEventListener("start", () => this._cancelTween?.());
  };

  // Translate camera + target by the same delta so we end up with target ===
  // worldPoint while preserving zoom and orientation.
  panCameraToWorldPoint = (worldPoint, { durationMs = PAN_DURATION_MS } = {}) => {
    if (!this.orbitControls) return;
    this._cancelTween?.();

    const camera = this.sceneManager.camera;
    const target = new Vector3(worldPoint.x, worldPoint.y, worldPoint.z);
    const startTarget = this.orbitControls.target.clone();
    const delta = target.clone().sub(startTarget);
    if (delta.lengthSq() < 1e-10) return;

    const startCamera = camera.position.clone();
    const t0 = performance.now();
    let cancelled = false;

    this._cancelTween = () => {
      cancelled = true;
      if (this._tweenRafId !== null) {
        cancelAnimationFrame(this._tweenRafId);
        this._tweenRafId = null;
      }
      this._cancelTween = null;
    };

    const step = (now) => {
      if (cancelled) return;
      const t = Math.min(1, (now - t0) / durationMs);
      const k = ease(t);
      this.orbitControls.target.copy(startTarget).addScaledVector(delta, k);
      camera.position.copy(startCamera).addScaledVector(delta, k);
      this.orbitControls.update();
      this.sceneManager.renderScene();
      if (t < 1) {
        this._tweenRafId = requestAnimationFrame(step);
      } else {
        this._tweenRafId = null;
        this._cancelTween = null;
      }
    };
    this._tweenRafId = requestAnimationFrame(step);
  };
}
