import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  AmbientLight,
  HemisphereLight,
  DirectionalLight,
  GridHelper,
} from "three";

import ControlsManager from "./ControlsManager";
import ImagesManager from "./ImagesManager";
import AnnotationsManager from "./AnnotationsManager";
import TransformControlsManager from "./TransformControlsManager";
import ClippingManager from "./ClippingManager";
import SectionContourManager from "./SectionContourManager";
import RenderModeManager from "./RenderModeManager";
import SketchPostFxManager from "./postfx/SketchPostFxManager";

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

    this.camera = null;
    this.addGrid = null;

    this.imagesManager = new ImagesManager({ sceneManager: this });
    this.annotationsManager = new AnnotationsManager({ sceneManager: this });
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

  _addCamera = () => {
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;
    const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(10, 10, 10);
    this.scene.add(camera);
    return camera;
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

  ///////////   UPDATE   ///////////

  _updateCamera = ({ width, height }) => {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };
}
