import {
  AmbientLight,
  DirectionalLight,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";

const DEFAULT_MAX_SIZE = 512;

/**
 * Render a top-down orthographic projection of a glTF scene to a transparent PNG.
 *
 * The camera looks down the glTF -Y axis with up = -Z, so the output image axes
 * match the 2D footprint used on the map: image x = model X (bbox.width),
 * image y = model Z (bbox.depth). The frustum is fitted exactly to the model
 * footprint, so drawing the PNG into the footprint rectangle keeps the object
 * at map scale.
 *
 * @param {Object} params
 * @param {import("three").Object3D} params.object3D - Parsed gltf.scene (glTF Y-up).
 * @param {Object} params.bbox - { width, height, depth, min, max } in meters.
 * @param {number} [params.maxSize] - Max output dimension in px.
 * @returns {string|null} PNG data URL, or null if rendering is unavailable.
 */
export default function renderGlbTopViewDataUrl({
  object3D,
  bbox,
  maxSize = DEFAULT_MAX_SIZE,
}) {
  if (!object3D || !bbox?.min || !bbox?.max) return null;

  const width = Math.max(bbox.width ?? 0, 1e-6);
  const depth = Math.max(bbox.depth ?? 0, 1e-6);
  const height = Math.max(bbox.height ?? 0, 0);
  const aspect = width / depth;

  let pxW;
  let pxH;
  if (aspect >= 1) {
    pxW = maxSize;
    pxH = Math.max(1, Math.round(maxSize / aspect));
  } else {
    pxH = maxSize;
    pxW = Math.max(1, Math.round(maxSize * aspect));
  }

  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) {
    console.warn("[renderGlbTopViewDataUrl] WebGL unavailable", e);
    return null;
  }

  try {
    renderer.setSize(pxW, pxH, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    scene.add(object3D);
    scene.add(new AmbientLight(0xffffff, 2));
    const keyLight = new DirectionalLight(0xffffff, 2.5);
    // Direction only matters (infinite light): above, slightly lateral for relief
    keyLight.position.set(1, 2.5, 1.5);
    scene.add(keyLight);

    const cx = (bbox.min.x + bbox.max.x) / 2;
    const cz = (bbox.min.z + bbox.max.z) / 2;

    const camera = new OrthographicCamera(
      -width / 2,
      width / 2,
      depth / 2,
      -depth / 2,
      0.1,
      height + 2
    );
    camera.position.set(cx, bbox.max.y + 1, cz);
    camera.up.set(0, 0, -1);
    camera.lookAt(cx, bbox.min.y, cz);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    const dataUrl = canvas.toDataURL("image/png");

    scene.remove(object3D);
    return dataUrl;
  } catch (e) {
    console.warn("[renderGlbTopViewDataUrl] render failed", e);
    return null;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
}
