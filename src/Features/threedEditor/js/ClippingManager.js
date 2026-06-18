import { Box3, Object3D, Plane, PlaneHelper, Vector3 } from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// Single clipping plane for the 3D viewer. Uses LOCAL clipping
// (renderer.localClippingEnabled + material.clippingPlanes) applied ONLY to the
// annotation + basemap meshes — never to the gizmo or the plane helper, so the
// draggable TransformControls gizmo isn't sliced by its own plane.
//
// The plane geometry lives here (three.js side) and is the source of truth,
// mirrored to the panel via subscribe(), exactly like the basemap transform in
// PanelBaseMapPosition3D.
export default class ClippingManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;

    // Plane normal = the proxy's local +X axis. Default vertical cut.
    this.plane = new Plane(new Vector3(1, 0, 0), 0);
    // Shared array referenced by every clipped material. Mutating the plane in
    // place keeps the array length at 1, so no shader recompile while dragging.
    this.planes = [this.plane];

    this.enabled = false;
    this.center = new Vector3();

    this.helper = null;
    this.gizmoProxy = null;
    this.controls = null;
    this.controlsHelper = null;

    this._listeners = new Set();
    this._unsubscribeReady = null;

    // Scratch objects reused per update to avoid per-frame allocation.
    this._normal = new Vector3();
    this._tmp = new Vector3();
  }

  init() {
    if (this.controls) return;

    // Plane helper (visual quad). Lies on the plane, so it follows it for free
    // at render time. Tagged so material walks never touch it.
    this.helper = new PlaneHelper(this.plane, 10, 0xffaa00);
    this.helper.visible = false;
    this.helper.userData.isClipHelper = true;
    this.sceneManager.scene.add(this.helper);

    // Proxy the gizmo attaches to. Its local +X axis is the plane normal.
    this.gizmoProxy = new Object3D();
    this.sceneManager.scene.add(this.gizmoProxy);

    const camera = this.sceneManager.camera;
    const domElement = this.sceneManager.renderer.domElement;
    this.controls = new TransformControls(camera, domElement);
    this.controls.setSpace("world");
    this.controls.setSize(0.8);
    this.controls.setMode("translate");
    this.controls.visible = false;
    this.controls.enabled = false;

    this.controlsHelper =
      typeof this.controls.getHelper === "function"
        ? this.controls.getHelper()
        : this.controls;
    // Tag so scene exporters / material walks prune the gizmo subtree.
    this.controlsHelper.userData.isGizmo = true;
    this.sceneManager.scene.add(this.controlsHelper);

    // Don't orbit the camera while dragging the gizmo.
    this.controls.addEventListener("dragging-changed", (event) => {
      const orbit = this.sceneManager.controlsManager?.orbitControls;
      if (orbit) orbit.enabled = !event.value;
    });

    this.controls.addEventListener("objectChange", () => {
      this._updatePlaneFromProxy();
      this._notify();
      this.sceneManager.renderScene();
    });

    this.controls.addEventListener("change", () => {
      this.sceneManager.renderScene();
    });

    // Re-clip annotations recreated after the first enable (incl. async GLBs).
    const annotationsManager = this.sceneManager.annotationsManager;
    if (annotationsManager?.subscribeAnnotationReady) {
      this._unsubscribeReady = annotationsManager.subscribeAnnotationReady(() =>
        this.reapply()
      );
    }
  }

  // Center the plane on the scene contents and size the helper. Called the
  // first time clipping is enabled.
  ensureCreated() {
    const box = this._computeSceneBox();
    if (box) {
      box.getCenter(this.center);
      const size = new Vector3();
      box.getSize(size);
      const helperSize = Math.max(size.x, size.y, size.z, 1) * 1.5;
      if (this.helper) this.helper.size = helperSize;
    } else {
      this.center.set(0, 0, 0);
      if (this.helper) this.helper.size = 10;
    }
    // Place the proxy at the center with default (vertical, +X normal)
    // orientation, then sync the plane.
    this.gizmoProxy.position.copy(this.center);
    this.gizmoProxy.quaternion.identity();
    this._updatePlaneFromProxy();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this._applyMaterials(enabled);
    if (this.helper) this.helper.visible = enabled;
    // Draw/clear the cut contour + feed the dimension snap.
    this.sceneManager.sectionContourManager?.setEnabled(enabled);
    this.sceneManager.renderScene();
  }

  setEditing(editing) {
    if (!this.controls) return;
    if (editing) {
      this.controls.attach(this.gizmoProxy);
      this.controls.enabled = true;
      this.controls.visible = true;
    } else {
      this.controls.detach();
      this.controls.enabled = false;
      this.controls.visible = false;
    }
    this.sceneManager.renderScene();
  }

  // "X" | "Y" | "Z" in USER convention (Z = vertical, CAD-style). The codebase
  // swaps three.js Y and Z (see userCoords.js), so user Z → three.js Y and
  // user Y → three.js Z. Orient the proxy so its +X axis (the normal) points
  // along the chosen world axis, keeping it on the same coplanar point.
  setAxis(axis) {
    const target =
      axis === "Z"
        ? new Vector3(0, 1, 0) // user Z (vertical) → three.js Y
        : axis === "Y"
        ? new Vector3(0, 0, 1) // user Y → three.js Z
        : new Vector3(1, 0, 0); // user X → three.js X
    this.gizmoProxy.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), target);
    this._updatePlaneFromProxy();
    this._notify();
    this.sceneManager.renderScene();
  }

  // Flip the normal: 180° turn of the proxy about its local +Y, so +X → -X.
  flip() {
    this.gizmoProxy.rotateY(Math.PI);
    this._updatePlaneFromProxy();
    this._notify();
    this.sceneManager.renderScene();
  }

  setGizmoMode(mode) {
    // mode: "translate" | "rotate"
    if (!this.controls) return;
    this.controls.setMode(mode);
    this.sceneManager.renderScene();
  }

  // Signed distance of the plane from the scene center along the current normal.
  setDistance(d) {
    this._currentNormal(this._normal);
    this.gizmoProxy.position
      .copy(this.center)
      .addScaledVector(this._normal, d);
    this._updatePlaneFromProxy();
    this._notify();
    this.sceneManager.renderScene();
  }

  getDistance() {
    this._currentNormal(this._normal);
    this._tmp.copy(this.gizmoProxy.position).sub(this.center);
    return this._tmp.dot(this._normal);
  }

  // Half the helper extent — enough to sweep the plane across the whole model.
  getMaxDistance() {
    return (this.helper?.size || 20) / 2;
  }

  reset() {
    this.gizmoProxy.position.copy(this.center);
    this.gizmoProxy.quaternion.identity();
    this._updatePlaneFromProxy();
    this._notify();
    this.sceneManager.renderScene();
  }

  // Re-assign the clipping planes to current geometry (after a reload).
  reapply() {
    if (this.enabled) {
      this._applyMaterials(true);
      // Annotations may have been recreated (incl. async EXTRUSION_PROFILE) —
      // recompute the contour against the new meshes.
      this.sceneManager.sectionContourManager?.update();
    }
  }

  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  dispose() {
    if (this._unsubscribeReady) {
      this._unsubscribeReady();
      this._unsubscribeReady = null;
    }
    if (this.controls) {
      this.controls.detach();
      this.controls.dispose?.();
    }
    if (this.controlsHelper) {
      this.sceneManager.scene.remove(this.controlsHelper);
    }
    if (this.helper) {
      this.sceneManager.scene.remove(this.helper);
      this.helper.dispose?.();
    }
    if (this.gizmoProxy) {
      this.sceneManager.scene.remove(this.gizmoProxy);
    }
    this._listeners.clear();
  }

  ///////////   INTERNAL   ///////////

  _currentNormal(out) {
    // Proxy local +X in world space.
    return out.set(1, 0, 0).applyQuaternion(this.gizmoProxy.quaternion).normalize();
  }

  _updatePlaneFromProxy() {
    this.gizmoProxy.updateMatrixWorld();
    this._currentNormal(this._normal);
    this.plane.setFromNormalAndCoplanarPoint(
      this._normal,
      this.gizmoProxy.position
    );
  }

  // Union of basemap groups + annotation objects. null when the scene is empty.
  _computeSceneBox() {
    const box = new Box3();
    box.makeEmpty();
    let hasAny = false;

    const addRoot = (root) => {
      if (!root) return;
      const b = new Box3().setFromObject(root);
      if (!b.isEmpty() && isFinite(b.min.x)) {
        box.union(b);
        hasAny = true;
      }
    };

    const images = this.sceneManager.imagesManager?.imagesMap || {};
    Object.values(images).forEach(addRoot);
    const annotations =
      this.sceneManager.annotationsManager?.annotationsObjectsMap || {};
    Object.values(annotations).forEach(addRoot);

    return hasAny ? box : null;
  }

  // Set (or clear) material.clippingPlanes on annotation + basemap meshes only.
  _applyMaterials(enabled) {
    const planes = enabled ? this.planes : null;
    const roots = [];
    const images = this.sceneManager.imagesManager?.imagesMap || {};
    Object.values(images).forEach((g) => g && roots.push(g));
    const annotations =
      this.sceneManager.annotationsManager?.annotationsObjectsMap || {};
    Object.values(annotations).forEach((o) => o && roots.push(o));

    roots.forEach((root) => {
      root.traverse((child) => {
        // Clip solids (Mesh) AND the black edge outlines / wireframes
        // (Line / LineSegments) — otherwise the cut-away part keeps showing
        // its wireframe. Line materials honor clippingPlanes too.
        if ((!child.isMesh && !child.isLine) || !child.material) return;
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          m.clippingPlanes = planes;
          // The clipping-plane COUNT changes (0 ↔ 1), which is a shader
          // #define — force a recompile. Only runs on enable/disable/reload,
          // never during a gizmo drag (that only mutates the plane in place).
          m.needsUpdate = true;
        });
      });
    });
  }

  _notify() {
    this._listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error("[ClippingManager] listener threw", e);
      }
    });
  }
}
