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
    // Render mode (Standard / Réaliste / Photoréaliste). Lazy: it only
    // touches the renderer/lights when setMode is called (post initScene).
    this.renderModeManager = new RenderModeManager({ sceneManager: this });

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
    // Init the transform controls eagerly so the editor mode panel can attach
    // them on first toggle without waiting for a lazy init.
    this.transformControlsManager.init();
    // Camera + renderer exist now; the clipping gizmo can be wired.
    this.clippingManager.init();
    // Subscribes to the clipping plane (must run after clippingManager.init).
    this.sectionContourManager.init();
  };

  resizeScene = () => {
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;

    this.renderer.setSize(width, height);
    this._updateCamera({ width, height });
    this.sectionContourManager?.onResize();
    // Aspect changed → reset the path tracer's sample accumulation.
    this.renderModeManager?.onCameraChange();
  };

  renderScene = () => {
    if (!this.scene || !this.camera) return;
    // While path tracing, an explicit render request means the scene changed
    // (camera moves are handled by ControlsManager directly): invalidate the
    // tracer, then still present a raster frame — synchronous callers (e.g.
    // the screenshot capture, which reads the canvas right after) rely on
    // renderScene actually drawing (no preserveDrawingBuffer).
    this.renderModeManager?.markSceneDirtyIfPathTracing?.();
    this.renderer.render(this.scene, this.camera);
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
