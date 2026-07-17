import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector2,
} from "three";

import {
  SPRAY_VERTEX_SHADER,
  SPRAY_FRAGMENT_SHADER,
  PARKED_Y,
  makeDropletTexture,
} from "./sprayRendering";

// In-memory paint layer of the shoot spray: every droplet that lands on a
// real face leaves a permanent dot, so held sprays accumulate into visible
// traces — enough to write on a wall. Session-only by design: the layer
// lives in the three.js scene (one per scene, surviving walk-mode toggles)
// and is never persisted; it dies with the scene or a page reload.
//
// Not exported to USDZ/OBJ (buildExportScene whitelists basemaps +
// annotations) and invisible to the pickers (Points, not a mesh).

// Ring capacity: beyond this, the oldest dots are overwritten
// (~40s of continuous spray at the walk-mode emission rate).
const CAPACITY = 50000;

const layersByScene = new WeakMap();

// Existing layer of the scene, or null — for consumers that must not
// allocate the ring just to act on it (e.g. the R "clear graffiti" key).
export function getSplatLayer(sceneManager) {
  return layersByScene.get(sceneManager.scene) ?? null;
}

export function getOrCreateSplatLayer(sceneManager, { color = 0x8d8d8d } = {}) {
  const scene = sceneManager.scene;
  let layer = layersByScene.get(scene);
  if (layer) return layer;

  const positions = new Float32Array(CAPACITY * 3);
  for (let i = 0; i < CAPACITY; i++) positions[i * 3 + 1] = PARKED_Y;
  const sizes = new Float32Array(CAPACITY);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));

  const bufferSize = sceneManager.renderer.getDrawingBufferSize(new Vector2());
  const material = new ShaderMaterial({
    uniforms: {
      uMap: { value: makeDropletTexture() },
      uColor: { value: new Color(color) },
      uOpacity: { value: 0.95 },
      uScale: { value: bufferSize.y * 0.5 },
    },
    vertexShader: SPRAY_VERTEX_SHADER,
    fragmentShader: SPRAY_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  points.name = "ShootSplats";
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;

  layer = {
    points,
    addSplat(x, y, z, size) {
      const i3 = cursor * 3;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      sizes[cursor] = size;
      cursor = (cursor + 1) % CAPACITY;
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
    },
    clear() {
      for (let i = 0; i < CAPACITY; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = PARKED_Y;
        positions[i * 3 + 2] = 0;
      }
      cursor = 0;
      geometry.attributes.position.needsUpdate = true;
    },
  };
  layersByScene.set(scene, layer);
  return layer;
}
