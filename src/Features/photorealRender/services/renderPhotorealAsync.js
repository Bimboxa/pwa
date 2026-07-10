import {
  WebGLRenderer,
  ACESFilmicToneMapping,
  PerspectiveCamera,
} from "three";
import { WebGLPathTracer } from "three-gpu-pathtracer";

import { swapToPbrMaterials } from "../utils/pbrMaterials";
import buildWhiteEnvironment from "../utils/environment";
import {
  setVisibilityByPredicate,
  isBasemap,
} from "../utils/sceneVisibility";

// Renders the scene with only basemap meshes visible, on a transparent
// background. Returns a PNG dataURL. Uses regular rasterisation (no path
// tracing) so the texture stays as crisp as in the live view.
function renderBasemapRaster(scene, camera, renderer) {
  const restoreVis = setVisibilityByPredicate(scene, isBasemap);
  const previousBackground = scene.background;
  scene.background = null;

  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png");

  scene.background = previousBackground;
  restoreVis();
  return dataUrl;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function compositeLayers(bottomUrl, topUrl, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const bottom = await loadImage(bottomUrl);
  ctx.drawImage(bottom, 0, 0, width, height);

  const top = await loadImage(topUrl);
  ctx.drawImage(top, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

export default async function renderPhotorealAsync({
  scene,
  camera,
  width,
  height,
  samples = 256,
  bounces = 2,
  onProgress,
}) {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const exportCamera =
    camera instanceof PerspectiveCamera ? camera.clone() : camera;
  if (exportCamera.aspect !== undefined) {
    exportCamera.aspect = width / height;
    exportCamera.updateProjectionMatrix();
  }

  try {
    // === Layer 1: basemap raster (sharp texture, transparent BG) ===
    const basemapPng = renderBasemapRaster(scene, exportCamera, renderer);

    // === Layer 2: path-traced annotations (basemap hidden) ===
    const restoreBasemapVis = setVisibilityByPredicate(
      scene,
      (obj) => !isBasemap(obj)
    );
    const restoreMaterials = swapToPbrMaterials(scene);
    const previousBackground = scene.background;
    const previousEnvironment = scene.environment;
    const previousEnvIntensity = scene.environmentIntensity;
    const env = buildWhiteEnvironment();
    scene.background = null;
    scene.environment = env;
    scene.environmentIntensity = 1.5;

    const tracer = new WebGLPathTracer(renderer);
    tracer.tiles.set(1, 1);
    tracer.bounces = bounces;
    tracer.transmissiveBounces = 10;
    tracer.renderToCanvas = true;
    tracer.rasterizeScene = false;
    tracer.minSamples = 1;
    tracer.renderDelay = 0;
    tracer.fadeDuration = 0;
    tracer.setScene(scene, exportCamera);

    let annotationsPng;
    try {
      while (tracer.samples < samples) {
        tracer.renderSample();
        onProgress?.(Math.min(tracer.samples, samples), samples);
        await new Promise((r) => setTimeout(r, 0));
      }
      annotationsPng = renderer.domElement.toDataURL("image/png");
    } finally {
      scene.background = previousBackground;
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousEnvIntensity;
      env.dispose();
      restoreMaterials();
      restoreBasemapVis();
    }

    // === Composite: basemap underneath, annotations on top ===
    return await compositeLayers(basemapPng, annotationsPng, width, height);
  } finally {
    renderer.dispose();
  }
}
