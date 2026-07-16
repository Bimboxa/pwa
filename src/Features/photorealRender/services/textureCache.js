import { RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";

import { getMaterial3dPreset } from "../utils/material3dPresets";

// Texture sets live in public/ (stable URLs, outside the bundle graph) and
// are deliberately NOT precached by the PWA service worker — online-only.
const TEXTURES_BASE_URL = `${import.meta.env.BASE_URL}photoreal/textures`;
const ANISOTROPY = 8;

// One texture-set promise per preset key. Each preset owns its texture
// instances, so the per-preset `repeat` is safe to set on the shared cache.
const cache = new Map();

function loadTextureAsync(url, { srgb = false, repeat = 1 } = {}) {
  return new Promise((resolve, reject) => {
    new TextureLoader().load(
      url,
      (texture) => {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(repeat, repeat);
        texture.anisotropy = ANISOTROPY;
        // Only the albedo is sRGB-encoded; normal/roughness stay linear.
        if (srgb) texture.colorSpace = SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      () => reject(new Error(`textureCache: failed to load ${url}`))
    );
  });
}

// Resolves { map, normalMap, roughnessMap } for a textured preset, or null
// for texture-less presets. Cached per preset for the app session.
export default function getPresetTexturesAsync(presetKey) {
  const preset = getMaterial3dPreset(presetKey);
  if (!preset?.textures) return Promise.resolve(null);
  if (cache.has(presetKey)) return cache.get(presetKey);

  const folder = `${TEXTURES_BASE_URL}/${preset.textures}`;
  // UVs are in meters (applyWorldBoxUVs): one tile covers textureScaleM.
  const repeat = 1 / (preset.textureScaleM || 1);
  const promise = Promise.all([
    loadTextureAsync(`${folder}/color.jpg`, { srgb: true, repeat }),
    loadTextureAsync(`${folder}/normal.jpg`, { repeat }),
    loadTextureAsync(`${folder}/roughness.jpg`, { repeat }),
  ])
    .then(([map, normalMap, roughnessMap]) => ({
      map,
      normalMap,
      roughnessMap,
    }))
    .catch((e) => {
      // Allow a retry on the next request (transient offline).
      cache.delete(presetKey);
      throw e;
    });
  cache.set(presetKey, promise);
  return promise;
}
