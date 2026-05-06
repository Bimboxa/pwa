import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// Wraps Three.js TransformControls and coordinates it with the existing
// OrbitControls so they don't fight over the pointer. Also exposes a
// subscribe() method so the editor mode panel can mirror the live transform
// while the user drags the gizmo.
export default class TransformControlsManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.controls = null;
    this.helper = null; // The helper object3D added to the scene (gizmo visuals).
    this._listeners = new Set();
    this._dragEndCallback = null;
    this._enabled = false;
  }

  init() {
    if (this.controls) return;

    const camera = this.sceneManager.camera;
    const domElement = this.sceneManager.renderer.domElement;
    this.controls = new TransformControls(camera, domElement);
    this.controls.setSpace("local");
    this.controls.setSize(0.8);
    this.controls.visible = false;
    this.controls.enabled = false;

    // Three.js r166+ requires adding the helper rather than the controls
    // themselves to the scene; older releases let you add the controls
    // directly. Cover both.
    this.helper =
      typeof this.controls.getHelper === "function"
        ? this.controls.getHelper()
        : this.controls;
    this.sceneManager.scene.add(this.helper);

    // Disable orbit while dragging the gizmo so the camera doesn't move with
    // the basemap. Restore on release and emit a single drag-end event so the
    // panel can persist to Dexie.
    this.controls.addEventListener("dragging-changed", (event) => {
      const orbit = this.sceneManager.controlsManager?.orbitControls;
      if (orbit) orbit.enabled = !event.value;
      if (event.value === false && this._dragEndCallback) {
        this._dragEndCallback();
      }
    });

    // While dragging, fire subscribers and request a re-render. No persistence
    // here — that happens once on drag end.
    this.controls.addEventListener("objectChange", () => {
      this._notify();
      this.sceneManager.renderScene();
    });

    // The gizmo also needs a re-render when its hover state changes (axis
    // highlighting, mode switches, etc.).
    this.controls.addEventListener("change", () => {
      this.sceneManager.renderScene();
    });
  }

  attach(object3D) {
    if (!this.controls) this.init();
    this.controls.attach(object3D);
    this._enabled = true;
    this.controls.enabled = true;
    this.controls.visible = true;
    this.sceneManager.renderScene();
  }

  detach() {
    if (!this.controls) return;
    this.controls.detach();
    this._enabled = false;
    this.controls.enabled = false;
    this.controls.visible = false;
    this.sceneManager.renderScene();
  }

  setMode(mode) {
    // mode: "translate" | "rotate"
    if (!this.controls) return;
    this.controls.setMode(mode);
  }

  // Register a listener for live transform updates (drag ticks). Returns an
  // unsubscribe function. The current transform is read from the attached
  // object3D — listeners do not receive an argument.
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  // Set the callback fired exactly once when the user releases the gizmo
  // (transitions from dragging → not dragging). Use this to persist the new
  // transform without needing to debounce per-frame writes.
  setDragEndCallback(callback) {
    this._dragEndCallback = callback;
  }

  _notify() {
    this._listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error("[TransformControlsManager] listener threw", e);
      }
    });
  }
}
