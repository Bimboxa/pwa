import { WebGLRenderTarget, Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

import SketchShader from "./SketchShader";
import createPaperTexture from "./createPaperTexture";
import { getSharedEdgeLineMaterial } from "./aquarelleMaterials";

// Post-processing pipeline for the AQUARELLE render mode. Owned (lazily) by
// SceneManager; toggled by RenderModeManager. When `enabled`, renderScene
// routes through composer.render() instead of renderer.render().
export default class SketchPostFxManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.enabled = false; // read by SceneManager.renderScene
    this.composer = null; // lazy — most sessions never enter AQUARELLE
    this._sketchPass = null;
    this._paperTexture = null;
    this._lastSize = new Vector2();
    this._lastRatio = 0;
  }

  setEnabled = (on) => {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this._ensureComposer();
  };

  // Called by SceneManager.renderScene when enabled. Self-syncs size AND
  // pixelRatio against the renderer so window resizes, panel-layout resizes
  // and the capture pixelRatio dance (snapshotThreedCanvasForCapture) all
  // work with no extra call sites.
  render = () => {
    const { renderer } = this.sceneManager;
    const dom = renderer.domElement;
    const width = dom.clientWidth || 1;
    const height = dom.clientHeight || 1;
    const ratio = renderer.getPixelRatio();
    if (
      width !== this._lastSize.x ||
      height !== this._lastSize.y ||
      ratio !== this._lastRatio
    ) {
      this.composer.setPixelRatio(ratio);
      this.composer.setSize(width, height);
      this._sketchPass.uniforms.uResolution.value.set(
        width * ratio,
        height * ratio
      );
      // LineMaterial wants CSS px (matches AnnotationsManager's resolution).
      getSharedEdgeLineMaterial().resolution.set(width, height);
      this._lastSize.set(width, height);
      this._lastRatio = ratio;
    }
    this.composer.render();
  };

  _ensureComposer = () => {
    if (this.composer) return;
    const { renderer, scene, camera } = this.sceneManager;
    // samples: 4 → keep MSAA through the composer (the raw canvas has
    // antialias: true; the composer's default target has none).
    const target = new WebGLRenderTarget(1, 1, { samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    // scene/camera are stable refs on SceneManager — lazy creation once is safe.
    this.composer.addPass(new RenderPass(scene, camera));
    // The render target is linear — without this pass the frame reaches the
    // screen without the linear→sRGB conversion and everything looks dark and
    // muddy. Must run BEFORE the sketch pass so grain/paper act on display
    // colors (their luminance weighting assumes sRGB).
    this.composer.addPass(new OutputPass());
    this._paperTexture = createPaperTexture();
    this._sketchPass = new ShaderPass(SketchShader);
    this._sketchPass.uniforms.tPaper.value = this._paperTexture;
    this.composer.addPass(this._sketchPass);
  };

  dispose = () => {
    this.composer?.dispose(); // disposes render targets + passes
    this._paperTexture?.dispose();
    this.composer = null;
    this._sketchPass = null;
    this._paperTexture = null;
    this.enabled = false;
  };
}
