import {
  WebGLRenderer,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  ACESFilmicToneMapping,
  PerspectiveCamera,
} from "three";
import {
  WebGLPathTracer,
  GradientEquirectTexture,
} from "three-gpu-pathtracer";

// Walk the scene and replace each MeshBasicMaterial with a MeshStandardMaterial
// (PBR), so the path-tracer can compute proper lighting / shadows / GI.
// Texture maps are preserved. Translucent annotations switch to PHYSICAL
// transmission (deterministic via transmissiveBounces) instead of stochastic
// alpha which produces banding artefacts.
// Basemap meshes (tagged userData.isBasemap) are skipped — they're rendered
// separately in a raster pass and composited under the path-trace.
function swapToPbrMaterials(scene) {
  const originals = new Map();
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    if (Array.isArray(obj.material)) return;
    if (!obj.material.isMeshBasicMaterial) return;
    if (obj.userData?.isBasemap) return;

    const src = obj.material;
    originals.set(obj, src);

    if (src.transparent && (src.opacity ?? 1) < 1) {
      const opacity = src.opacity ?? 1;
      obj.material = new MeshPhysicalMaterial({
        color: src.color.clone(),
        map: src.map ?? null,
        side: src.side,
        roughness: 0.85,
        metalness: 0,
        transmission: 1 - opacity,
        thickness: 0,
        ior: 1,
      });
    } else {
      obj.material = new MeshStandardMaterial({
        color: src.color.clone(),
        map: src.map ?? null,
        alphaMap: src.alphaMap ?? null,
        opacity: src.opacity,
        transparent: src.transparent,
        side: src.side,
        roughness: 0.85,
        metalness: 0,
      });
    }
  });
  return () => {
    originals.forEach((mat, obj) => {
      obj.material.dispose();
      obj.material = mat;
    });
  };
}

function buildWhiteEnvironment() {
  const env = new GradientEquirectTexture(16);
  env.topColor.set(0xffffff);
  env.bottomColor.set(0xc0c0c0);
  env.update();
  return env;
}

// Toggle visibility on all renderable children of the scene. The predicate
// decides whether each renderable should be drawn in this pass. Returns a
// restore() callback that puts the original visibility back.
//
// Only renderables (Mesh/Line/LineSegments/Points/Sprite) are toggled, never
// transform groups: in Three.js a parent's `visible=false` cascades to ALL
// descendants regardless of their own flag. Since annotations are attached
// as children of the basemap group (so a translate/rotate of the basemap
// carries them along), toggling that group would either hide the basemap
// mesh + annotations together (Layer 1) or hide them together (Layer 2).
// Leaving groups always visible and only flipping the leaf renderables lets
// the predicate cleanly select what actually draws.
function setVisibilityByPredicate(scene, shouldKeepVisible) {
  const restore = [];
  scene.traverse((obj) => {
    if (obj === scene) return;
    if (obj.isCamera || obj.isLight) return;
    if (
      !obj.isMesh &&
      !obj.isLine &&
      !obj.isLineSegments &&
      !obj.isPoints &&
      !obj.isSprite
    )
      return;
    const wasVisible = obj.visible;
    const keep = shouldKeepVisible(obj);
    if (wasVisible !== keep) {
      restore.push([obj, wasVisible]);
      obj.visible = keep;
    }
  });
  return () => {
    restore.forEach(([obj, vis]) => {
      obj.visible = vis;
    });
  };
}

function isBasemap(obj) {
  if (obj.userData?.isBasemap) return true;
  // Walk up the parents in case the basemap is nested in a group later.
  let p = obj.parent;
  while (p) {
    if (p.userData?.isBasemap) return true;
    p = p.parent;
  }
  return false;
}

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
