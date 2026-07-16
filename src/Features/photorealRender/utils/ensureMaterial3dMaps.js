import getPresetTexturesAsync from "../services/textureCache";

// Materials awaiting their texture set. A WeakSet (not a userData flag) on
// purpose: material.clone() deep-copies userData, so a flag would make clones
// (e.g. the ramp-surface clone in createAnnotationObject3D) skip the request
// and stay untextured forever.
const inFlight = new WeakSet();

// Idempotently attaches the material3d preset texture maps to `material`
// (tagged with userData.material3dPresetKey by createMaterial3dMaterial).
// Called at material creation AND from AnnotationsManager's finishing pass —
// the latter covers clones made before the async textures resolved.
export default function ensureMaterial3dMaps(material, onLoaded) {
  const presetKey = material?.userData?.material3dPresetKey;
  if (!presetKey || material.map || inFlight.has(material)) return;
  inFlight.add(material);
  getPresetTexturesAsync(presetKey)
    .then((maps) => {
      if (!maps) return;
      material.map = maps.map;
      material.normalMap = maps.normalMap;
      material.roughnessMap = maps.roughnessMap;
      material.needsUpdate = true;
      onLoaded?.();
    })
    .catch((e) => {
      // Offline / missing asset: scalar PBR values still apply; allow a
      // retry on the next finishing pass.
      inFlight.delete(material);
      console.error("[ensureMaterial3dMaps] textures failed", e);
    });
}
