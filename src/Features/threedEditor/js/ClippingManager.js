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

    // Plane normal = the proxy's local +X axis. Default: a vertical cutting
    // plane whose normal points along three.js Z.
    this.plane = new Plane(new Vector3(0, 0, 1), 0);
    // Shared array referenced by every clipped material. Mutating the plane in
    // place keeps the array length at 1, so no shader recompile while dragging.
    this.planes = [this.plane];

    this.enabled = false;
    this.editing = false;
    this.center = new Vector3();

    this.helper = null;
    this.gizmoProxy = null;
    // Two simultaneous gizmos sharing the same proxy: a single-arrow translate
    // gizmo along the plane normal (proxy local +X) and a single-ring rotate
    // gizmo around the vertical axis (world three.js Y). Both are shown at once.
    this.controlsTranslate = null;
    this.controlsRotate = null;
    this.controlsHelperTranslate = null;
    this.controlsHelperRotate = null;

    this._listeners = new Set();
    this._unsubscribeReady = null;

    // Scratch objects reused per update to avoid per-frame allocation.
    this._normal = new Vector3();
    this._tmp = new Vector3();
  }

  init() {
    if (this.controlsTranslate) return;

    // Plane helper (visual quad). Lies on the plane, so it follows it for free
    // at render time. Tagged so material walks never touch it.
    this.helper = new PlaneHelper(this.plane, 10, 0xffaa00);
    this.helper.visible = false;
    this.helper.userData.isClipHelper = true;
    this.sceneManager.scene.add(this.helper);

    // Proxy the gizmos attach to. Its local +X axis is the plane normal.
    // Default orientation: normal along three.js Z (vertical cutting plane).
    this.gizmoProxy = new Object3D();
    this._setDefaultOrientation();
    this.sceneManager.scene.add(this.gizmoProxy);

    const camera = this.sceneManager.camera;
    const domElement = this.sceneManager.renderer.domElement;

    // Translate gizmo: a single arrow along the plane normal. Local space so
    // the X handle follows the proxy's rotated +X (the normal); only X shown.
    this.controlsTranslate = new TransformControls(camera, domElement);
    this.controlsTranslate.setMode("translate");
    this.controlsTranslate.setSpace("local");
    this.controlsTranslate.setSize(0.8);
    this.controlsTranslate.showX = true;
    this.controlsTranslate.showY = false;
    this.controlsTranslate.showZ = false;
    this.controlsTranslate.visible = false;
    this.controlsTranslate.enabled = false;

    // Rotate gizmo: a single ring around the vertical axis. World space so the
    // Y handle is the scene's vertical (three.js Y), independent of the proxy's
    // current orientation; only Y shown.
    this.controlsRotate = new TransformControls(camera, domElement);
    this.controlsRotate.setMode("rotate");
    this.controlsRotate.setSpace("world");
    this.controlsRotate.setSize(1);
    this.controlsRotate.showX = false;
    this.controlsRotate.showY = true;
    this.controlsRotate.showZ = false;
    this.controlsRotate.visible = false;
    this.controlsRotate.enabled = false;

    this.controlsHelperTranslate = this._addControls(this.controlsTranslate);
    this.controlsHelperRotate = this._addControls(this.controlsRotate);

    // Re-clip annotations recreated after the first enable (incl. async GLBs).
    const annotationsManager = this.sceneManager.annotationsManager;
    if (annotationsManager?.subscribeAnnotationReady) {
      this._unsubscribeReady = annotationsManager.subscribeAnnotationReady(() =>
        this.reapply()
      );
    }
  }

  // Add one TransformControls' helper to the scene and wire the shared event
  // handlers (orbit lock on drag, plane sync + redraw on change). Returns the
  // helper object added to the scene.
  _addControls(controls) {
    const helper =
      typeof controls.getHelper === "function"
        ? controls.getHelper()
        : controls;
    // Tag so scene exporters / material walks prune the gizmo subtree.
    helper.userData.isGizmo = true;
    this.sceneManager.scene.add(helper);

    // Don't orbit the camera while dragging the gizmo.
    controls.addEventListener("dragging-changed", (event) => {
      const orbit = this.sceneManager.controlsManager?.orbitControls;
      if (orbit) orbit.enabled = !event.value;
    });

    controls.addEventListener("objectChange", () => {
      this._updatePlaneFromProxy();
      this._notify();
      this.sceneManager.renderScene();
    });

    controls.addEventListener("change", () => {
      this.sceneManager.renderScene();
    });

    return helper;
  }

  // Orient the proxy so its local +X (the plane normal) points along three.js
  // Z — the default vertical cutting plane.
  _setDefaultOrientation() {
    this.gizmoProxy.quaternion.setFromUnitVectors(
      new Vector3(1, 0, 0),
      new Vector3(0, 0, 1)
    );
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
    // Place the proxy at the center with default (vertical, +Z normal)
    // orientation, then sync the plane. Called on every enable, so deleting
    // then re-creating the plane fully resets position and orientation.
    this.gizmoProxy.position.copy(this.center);
    this._setDefaultOrientation();
    this._updatePlaneFromProxy();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this._applyMaterials(enabled);
    // The PlaneHelper quad is only shown while EDITING the plane (gizmo mode).
    // When merely active we want just the cut "imprint" on the meshes (the
    // section contour) + the visible meshes, not the translucent plane overlay.
    if (this.helper) this.helper.visible = enabled && this.editing;
    // Draw/clear the cut contour + feed the dimension snap.
    this.sceneManager.sectionContourManager?.setEnabled(enabled);
    this.sceneManager.renderScene();
  }

  setEditing(editing) {
    if (!this.controlsTranslate) return;
    this.editing = editing;
    const both = [this.controlsTranslate, this.controlsRotate];
    if (editing) {
      both.forEach((c) => {
        c.attach(this.gizmoProxy);
        c.enabled = true;
        c.visible = true;
      });
    } else {
      both.forEach((c) => {
        c.detach();
        c.enabled = false;
        c.visible = false;
      });
    }
    // Show the PlaneHelper quad only while editing (alongside the gizmos).
    if (this.helper) this.helper.visible = this.enabled && editing;
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

  // Orient + position the plane from an arbitrary world-space normal and a
  // coplanar point (three.js coords). Used to drive the cut plane from a 2D
  // segment drawn on the baseMap (top view). Same proxy convention as setAxis:
  // the proxy's local +X axis is the plane normal.
  setFromWorldNormalAndPoint(normal, point) {
    if (!this.gizmoProxy) return;
    const n = normal.clone().normalize();
    this.gizmoProxy.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), n);
    this.gizmoProxy.position.copy(point);
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
    this._setDefaultOrientation();
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
    [this.controlsTranslate, this.controlsRotate].forEach((c) => {
      if (c) {
        c.detach();
        c.dispose?.();
      }
    });
    [this.controlsHelperTranslate, this.controlsHelperRotate].forEach((h) => {
      if (h) this.sceneManager.scene.remove(h);
    });
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
