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

    // Default mouse mapping: left = ROTATE, right = TRUCK (pan), wheel = DOLLY.
    // Right-drag stays available for pan; on a Mac trackpad that's awkward, so
    // we also map Option(Alt) + left-drag to pan by swapping the left action
    // while Alt is held (see _onModifierKey / window blur reset below).
    window.addEventListener("keydown", this._onModifierKey);
    window.addEventListener("keyup", this._onModifierKey);
    window.addEventListener("blur", this._onWindowBlur);

    // Prime the internal matrices, render once, then start the update loop.
    this.cameraControls.update(0);
    this.sceneManager.renderScene();
    this._clock.getDelta(); // reset delta so the first frame isn't a huge step
    this._loop();
  };

  // ----- Option(Alt)+drag pan ------------------------------------------

  // Swap the left-mouse action to TRUCK (pan) while Alt is held, back to ROTATE
  // otherwise. Only mutate on a real change so we don't disturb an in-flight
  // gesture every keyrepeat.
  _setPanModifier = (active) => {
    const controls = this.cameraControls;
    if (!controls) return;
    const want = active
      ? CameraControls.ACTION.TRUCK
      : CameraControls.ACTION.ROTATE;
    if (controls.mouseButtons.left !== want) {
      controls.mouseButtons.left = want;
    }
  };

  _onModifierKey = (event) => {
    this._setPanModifier(event.altKey === true);
  };

  // If focus leaves the window while Alt is held, the keyup never arrives —
  // reset to ROTATE so the left button isn't stuck panning.
  _onWindowBlur = () => {
    this._setPanModifier(false);
  };

  // ----- continuous update loop (render only on change) ----------------

  _loop = () => {
    if (this._disposed) return;
    const delta = this._clock.getDelta();
    const updated = this.cameraControls.update(delta);
    if (updated) this.sceneManager.renderScene();
    this._rafId = requestAnimationFrame(this._loop);
  };

  dispose = () => {
    this._disposed = true;
    window.removeEventListener("keydown", this._onModifierKey);
    window.removeEventListener("keyup", this._onModifierKey);
    window.removeEventListener("blur", this._onWindowBlur);
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

  // Frame all annotation meshes (the useAnnotationsV2 set already loaded into
  // the scene). Preserves the current orbit orientation and only dollies/pans
  // to fit. When the scene has no annotations, frame a 10 m cube resting on the
  // ground (y=0) and centered on the world origin.
  fitToAnnotations = () => {
    if (!this.cameraControls) return;

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

    const padding = 0.5; // metres of breathing room around the geometry
    this.cameraControls.fitToBox(box, true, {
      paddingLeft: padding,
      paddingRight: padding,
      paddingTop: padding,
      paddingBottom: padding,
    });
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
