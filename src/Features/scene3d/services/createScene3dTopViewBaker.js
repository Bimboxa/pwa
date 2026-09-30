import {
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";

import buildScene3dChunkGeometry, {
  applyScene3dChunkTransform,
} from "../js/buildScene3dChunkGeometry";

// Finest useful resolution of the projection (small scans: 5 mm / px).
const MAX_PX_PER_METER = 200;

// Top-down orthographic projection ("top view") of a scan, baked at import.
//
// The camera looks down the scan -Z with +Y up and a frustum equal to the
// scan XY extent: the image is metric (pxPerMeter) and image top = scan +Y,
// which is the pose of the annotation bbox on the base map.
//
// The scan is rendered ATLAS BY ATLAS into the same buffer (no clear, depth
// kept): only one texture is on the GPU at a time, whatever the scan size.
// Throwaway renderer on a detached canvas, released by dispose().
//
// bbox: {min: [x, y, z], max: [x, y, z]} (meters, scan frame).
export default function createScene3dTopViewBaker({ bbox, maxPx = 4096 }) {
  const extentX = Math.max(bbox.max[0] - bbox.min[0], 1e-6);
  const extentY = Math.max(bbox.max[1] - bbox.min[1], 1e-6);
  const extentZ = Math.max(bbox.max[2] - bbox.min[2], 0);

  const canvas = document.createElement("canvas");
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  const gl = renderer.getContext();

  // GPU limits: the browser silently shrinks an oversized drawing buffer.
  const viewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const limit = Math.min(
    maxPx,
    gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    gl.getParameter(gl.MAX_TEXTURE_SIZE),
    viewportDims[0],
    viewportDims[1]
  );
  let pxPerMeter = Math.min(
    MAX_PX_PER_METER,
    limit / Math.max(extentX, extentY)
  );
  let width = 1;
  let height = 1;
  for (let attempt = 0; attempt < 4; attempt++) {
    width = Math.max(1, Math.round(extentX * pxPerMeter));
    height = Math.max(1, Math.round(extentY * pxPerMeter));
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    if (gl.drawingBufferWidth === width && gl.drawingBufferHeight === height) {
      break;
    }
    pxPerMeter /= 2;
  }

  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  renderer.clear();

  const camera = new OrthographicCamera(
    bbox.min[0],
    bbox.max[0],
    bbox.max[1],
    bbox.min[1],
    0.5,
    extentZ + 2
  );
  camera.position.set(0, 0, bbox.max[2] + 1);
  camera.updateProjectionMatrix();

  return {
    width,
    height,
    pxPerMeter,

    // rows: the GEOMETRY rows of one atlas; bitmap: its ImageBitmap (left
    // open — the caller owns it) or null (untextured / missing texture).
    renderAtlas(rows, bitmap) {
      const scene = new Scene();
      let texture = null;
      let material;
      if (bitmap && rows.some((row) => row.uvs)) {
        texture = new Texture(bitmap);
        // The uvs are stored for unflipped textures (first row = image top).
        texture.flipY = false;
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.needsUpdate = true;
        material = new MeshBasicMaterial({ map: texture, side: DoubleSide });
      } else {
        material = new MeshNormalMaterial({
          flatShading: true,
          side: DoubleSide,
        });
      }
      const geometries = rows.map((row) => {
        const geometry = buildScene3dChunkGeometry(row);
        const mesh = new Mesh(geometry, material);
        applyScene3dChunkTransform(mesh, bbox);
        scene.add(mesh);
        return geometry;
      });
      renderer.render(scene, camera);
      geometries.forEach((geometry) => geometry.dispose());
      material.dispose();
      texture?.dispose();
    },

    // → {blob, fileMime} (WebP; PNG where the browser cannot encode WebP)
    toBlob() {
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) reject(new Error("Top view encoding failed."));
            else resolve({ blob, fileMime: blob.type || "image/png" });
          },
          "image/webp",
          0.9
        );
      });
    },

    dispose() {
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
