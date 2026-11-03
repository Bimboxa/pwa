import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  OrthographicCamera,
  AmbientLight,
  HemisphereLight,
  DirectionalLight,
  GridHelper,
  AxesHelper,
} from "three";

import ControlsManager from "./ControlsManager";
import ImagesManager from "./ImagesManager";
import AnnotationsManager from "./AnnotationsManager";
import PhotoPlansManager from "./PhotoPlansManager";
import TransformControlsManager from "./TransformControlsManager";
import ClippingManager from "./ClippingManager";
import SectionContourManager from "./SectionContourManager";
import RenderModeManager from "./RenderModeManager";
import SketchPostFxManager from "./postfx/SketchPostFxManager";

import BaseMapsGridManager from "Features/baseMapsGrid3d/js/BaseMapsGridManager";

import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";

// Length (m) of the in-scene axes helper ("Afficher les axes dans la scène").
const SCENE_AXES_SIZE_M = 5;

// Depth range of the orthographic camera (« Caméra ortho »), symmetric
// around the camera plane: in a parallel projection the orbit distance has
// no visual meaning, so nothing standing "behind" the camera point (a tall
// element while the camera sits low over the plan) may be clipped away. A
// linear depth buffer over 2 km keeps a sub-millimetre resolution.
const ORTHO_HALF_DEPTH_M = 1000;

export default class SceneManager {
  constructor({ containerEl, onRendererIsReady }) {
    this.containerEl = containerEl;
    this.onRendererIsReady = onRendererIsReady;

    this.scene = new Scene();
    this.renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    this.ambiantLight = null;
    this.hemisphereLight = null;
    this.directionalLight = null;

    // Active camera (what renders, raycasts and projects): one of the two
    // below, swapped by setActiveCamera (ControlsManager._applyProjection).
    this.camera = null;
    this.perspectiveCamera = null;
    this.orthographicCamera = null;
    this.addGrid = null;
    this.axes = null;

    // Called after every renderScene() — the "camera may have moved" signal
    // of DOM overlays that follow the camera (AxesGizmoThreed). Covers the
    // camera-controls loop, walk mode and every other render caller without
    // an extra rAF loop.
    this._renderListeners = new Set();

    this.imagesManager = new ImagesManager({ sceneManager: this });
    // 3D base maps grid ("table à plans"): poses the base map groups as paper
    // sheets. ImagesManager and ThreedEditor consult it while it is open.
    this.baseMapsGridManager = new BaseMapsGridManager({ sceneManager: this });
    this.annotationsManager = new AnnotationsManager({ sceneManager: this });
    // Textured planes of calibrated photoPlans (photo baseMaps have no flat
    // plane in the scene — these are their 3D presence).
    this.photoPlansManager = new PhotoPlansManager({ sceneManager: this });
    this.controlsManager = new ControlsManager({ sceneManager: this });
    this.transformControlsManager = new TransformControlsManager({
      sceneManager: this,
    });
    this.clippingManager = new ClippingManager({ sceneManager: this });
    // Created after clippingManager: it subscribes to the clipping plane to
    // draw the cut contour and feed the dimension snap.
    this.sectionContourManager = new SectionContourManager({
      sceneManager: this,
    });
    // Render mode (Standard / Réaliste / Photoréaliste / Aquarelle). Lazy: it
    // only touches the renderer/lights when setMode is called (post initScene).
    this.renderModeManager = new RenderModeManager({ sceneManager: this });
    // AQUARELLE post-processing — created on first use only (ensureSketchPostFx).
    this.sketchPostFx = null;

    window.addEventListener("resize", this.resizeScene);
  }

  initScene = () => {
    this.ambiantLight = this._addAmbiantLight();
    this.hemisphereLight = this._addHemisphereLight();
    this.directionalLight = this._addDirectionalLight();
    this.camera = this._addCamera();
    this.grid = this._addGrid();
    this.axes = this._addAxes();

    this._initRenderer();
    this.controlsManager.initControls();

    // The window "resize" listener misses pure layout changes (a startup
    // overlay/drawer that collapses after load, panels toggling) — the canvas
    // then keeps a stale fixed size (setSize pins its CSS size) until the
    // next window resize. Track the container itself instead.
    this._resizeObserver = new ResizeObserver(() => this.resizeScene());
    this._resizeObserver.observe(this.containerEl);

    // Init the transform controls eagerly so the editor mode panel can attach
    // them on first toggle without waiting for a lazy init.
    this.transformControlsManager.init();
    // Camera + renderer exist now; the clipping gizmo can be wired.
    this.clippingManager.init();
    // Subscribes to the clipping plane (must run after clippingManager.init).
    this.sectionContourManager.init();
  };

  resizeScene = () => {
    if (!this.camera || !this.renderer) return;
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;
    if (!width || !height) return;

    this.renderer.setSize(width, height);
    this._updateCamera({ width, height });
    this.sectionContourManager?.onResize();
    this.baseMapsGridManager?.onResize();
    this.renderScene();
  };

  // Re-sync the canvas to its container if a layout change was missed (the
  // 2D/3D switch calls this before measuring the viewport, so the camera
  // match is never computed against a stale canvas size).
  ensureSizeSynced = () => {
    const dom = this.renderer?.domElement;
    if (!dom || !this.containerEl) return;
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;
    if (!width || !height) return;
    if (dom.clientWidth !== width || dom.clientHeight !== height) {
      this.resizeScene();
    }
  };

  renderScene = () => {
    if (!this.scene || !this.camera) return;
    // AQUARELLE routes the single draw path through the sketch composer, so
    // every caller (resize, hover, capture, controls) picks up the effect.
    if (this.sketchPostFx?.enabled) this.sketchPostFx.render();
    else this.renderer.render(this.scene, this.camera);
    this._renderListeners.forEach((listener) => listener());
  };

  addRenderListener = (listener) => {
    if (typeof listener === "function") this._renderListeners.add(listener);
  };

  removeRenderListener = (listener) => {
    this._renderListeners.delete(listener);
  };

  // rAF-coalesced renderScene: N requests landing in the same frame cost one
  // draw. For bursty callers (async GLB loads, CSG carve completions, batch
  // annotation-ready subscribers) — synchronous call sites keep renderScene.
  requestRender = () => {
    if (this._renderRequested) return;
    this._renderRequested = true;
    requestAnimationFrame(() => {
      this._renderRequested = false;
      this.renderScene();
    });
  };

  ensureSketchPostFx = () => {
    if (!this.sketchPostFx) {
      this.sketchPostFx = new SketchPostFxManager({ sceneManager: this });
    }
    return this.sketchPostFx;
  };

  ///////////   INIT  ///////////

  _initRenderer = () => {
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Enable per-material clipping planes (used by ClippingManager). Local
    // clipping leaves the gizmo + helper untouched, unlike global clipping.
    this.renderer.localClippingEnabled = true;
    this.containerEl.appendChild(this.renderer.domElement);
    this.onRendererIsReady();
  };

  // Both cameras are created up front; the perspective one is the default
  // active camera. The orthographic frustum is sized on activation
  // (setOrthoVisibleHeight) from the perspective view it replaces.
  _addCamera = () => {
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;
    const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(10, 10, 10);
    this.scene.add(camera);
    this.perspectiveCamera = camera;

    const ortho = new OrthographicCamera(
      -1,
      1,
      1,
      -1,
      -ORTHO_HALF_DEPTH_M,
      ORTHO_HALF_DEPTH_M
    );
    ortho.position.copy(camera.position);
    this.scene.add(ortho);
    this.orthographicCamera = ortho;
    return camera;
  };

  // Orthographic frustum showing `heightM` metres over the viewport height
  // (width follows the canvas aspect), zoom reset to 1 — the ortho
  // counterpart of a perspective camera at distance d: h = 2·d·tan(fov/2).
  setOrthoVisibleHeight = (heightM) => {
    const ortho = this.orthographicCamera;
    if (!ortho || !(heightM > 0) || !Number.isFinite(heightM)) return;
    const width = this.containerEl?.clientWidth || 1;
    const height = this.containerEl?.clientHeight || 1;
    const aspect = width / height;
    ortho.top = heightM / 2;
    ortho.bottom = -heightM / 2;
    ortho.left = (-heightM / 2) * aspect;
    ortho.right = (heightM / 2) * aspect;
    ortho.zoom = 1;
    ortho.updateProjectionMatrix();
  };

  // Depth range of the orthographic camera: ±halfDepthM around the camera
  // plane, never below ORTHO_HALF_DEPTH_M. Driven by the perspective far
  // plane (ControlsManager._syncOrthoDepthRange) so an orbit at the dolly
  // limit never clips its pivot away. Kept symmetric: three's
  // Raycaster.setFromCamera and camera-controls' zoom-to-cursor both put
  // NDC z = (near + far) / (near - far) = 0 on the camera plane.
  setOrthoDepthRange = (halfDepthM) => {
    const ortho = this.orthographicCamera;
    if (!ortho) return;
    const h = Math.max(
      ORTHO_HALF_DEPTH_M,
      Number.isFinite(halfDepthM) ? halfDepthM : 0
    );
    if (ortho.near === -h && ortho.far === h) return;
    ortho.near = -h;
    ortho.far = h;
    ortho.updateProjectionMatrix();
  };

  // Metres spanned by the viewport height for the ACTIVE camera: the scale
  // invariant of every projection switch (ortho toggle, 2D/3D switch,
  // capture framing). Perspective: at the orbit distance (the target plane).
  getVisibleHeightM = () => {
    const camera = this.camera;
    if (!camera) return null;
    if (camera.isOrthographicCamera) {
      return (camera.top - camera.bottom) / (camera.zoom || 1);
    }
    const distance = this.controlsManager?.cameraControls?.distance;
    if (!(distance > 0)) return null;
    const fovDeg = camera.getEffectiveFOV?.() ?? camera.fov;
    return 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
  };

  // Swap the active camera: everything reading `sceneManager.camera` follows
  // on its next call; the objects holding their own reference are retargeted
  // here (the transform gizmos, the clipping gizmos, the AQUARELLE render
  // pass). camera-controls is retargeted by the caller
  // (ControlsManager._applyProjection) since the pose conversion is its job.
  setActiveCamera = (camera) => {
    if (!camera || camera === this.camera) return;
    this.camera = camera;
    const tc = this.transformControlsManager?.controls;
    if (tc) tc.camera = camera;
    const cm = this.clippingManager;
    if (cm?.controlsTranslate) cm.controlsTranslate.camera = camera;
    if (cm?.controlsRotate) cm.controlsRotate.camera = camera;
    this.sketchPostFx?.setCamera?.(camera);
    this.requestRender?.();
  };

  _addAmbiantLight = () => {
    // Kept moderate so the directional contrast still reads on slopes, but
    // high enough (with the hemisphere fill + material emissive) to avoid a
    // too-dark result.
    const ambientLight = new AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);
    return ambientLight;
  };

  // Sky/ground fill. World up is +Y (the GridHelper lies in the XZ plane and
  // basemaps are laid flat by the parent group rotation, so annotation tops
  // point toward +Y). Keeps horizontal surfaces (flat annotations) bright
  // while giving sloped faces a soft gradient.
  _addHemisphereLight = () => {
    const light = new HemisphereLight(0xffffff, 0x9aa0a6, 0.9);
    this.scene.add(light);
    return light;
  };

  // Directional key light from above, offset in X/Z, so slope faces oriented
  // toward it read brighter — this is what reveals the 3D form of a ramp.
  _addDirectionalLight = () => {
    const light = new DirectionalLight(0xffffff, 0.6);
    light.position.set(8, 15, 6);
    this.scene.add(light);
    return light;
  };

  _addGrid = () => {
    const grid = new GridHelper(100, 50);
    this.scene.add(grid);
    return grid;
  };

  // Coloured axes of the user frame, hidden by default (3D view settings
  // "Afficher les axes dans la scène"). User-facing convention is Z up
  // (utils/userCoords): world Y (vertical) takes the Z colour, world Z the Y
  // colour. The yaw and the origin of the displayed frame are applied by
  // MainThreedEditor (axes.rotation.y / axes.position, from
  // threedEditor.axesSettings). Drawn on top of the scene so it stays
  // readable over a base map; tagged isGizmo like the transform gizmos, and
  // isAxesFrame so its origin enters the vertex snap index (useVertexSnap).
  _addAxes = () => {
    const axes = new AxesHelper(SCENE_AXES_SIZE_M);
    axes.setColors(AXIS_COLORS.X, AXIS_COLORS.Z, AXIS_COLORS.Y);
    axes.material.depthTest = false;
    axes.material.depthWrite = false;
    axes.material.transparent = true;
    axes.renderOrder = 999;
    axes.visible = false;
    axes.userData.isGizmo = true;
    axes.userData.isAxesFrame = true;
    this.scene.add(axes);
    return axes;
  };

  ///////////   UPDATE   ///////////

  _updateCamera = ({ width, height }) => {
    const aspect = width / height;
    const persp = this.perspectiveCamera ?? this.camera;
    if (persp?.isPerspectiveCamera) {
      persp.aspect = aspect;
      persp.updateProjectionMatrix();
    }
    // The orthographic frustum keeps its visible height; the width follows.
    const ortho = this.orthographicCamera;
    if (ortho) {
      const halfH = (ortho.top - ortho.bottom) / 2;
      ortho.left = -halfH * aspect;
      ortho.right = halfH * aspect;
      ortho.updateProjectionMatrix();
    }
  };
}
