import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  AmbientLight,
  GridHelper,
} from "three";

import ControlsManager from "./ControlsManager";
import ImagesManager from "./ImagesManager";
import AnnotationsManager from "./AnnotationsManager";

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

    this.camera = null;
    this.addGrid = null;

    this.imagesManager = new ImagesManager({ sceneManager: this });
    this.annotationsManager = new AnnotationsManager({ sceneManager: this });
    this.controlsManager = new ControlsManager({ sceneManager: this });

    window.addEventListener("resize", this.resizeScene);
  }

  initScene = () => {
    this.ambiantLight = this._addAmbiantLight();
    this.camera = this._addCamera();
    this.grid = this._addGrid();

    this._initRenderer();
    this.controlsManager.initControls();
  };

  resizeScene = () => {
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;

    this.renderer.setSize(width, height);
    this._updateCamera({ width, height });
  };

  renderScene = () => {
    if (this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  ///////////   INIT  ///////////

  _initRenderer = () => {
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    const ambientLight = new AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    return ambientLight;
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
