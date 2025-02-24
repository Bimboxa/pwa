import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

export default class ControlsManager {
  constructor({sceneManager}) {
    this.sceneManager = sceneManager;
    this.orbitControls = null;
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
  };
}
