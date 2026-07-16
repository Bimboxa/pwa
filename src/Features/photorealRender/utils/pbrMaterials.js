import { Color, MeshStandardMaterial, MeshPhysicalMaterial } from "three";

import ensureMaterial3dMaps from "./ensureMaterial3dMaps";
import { getMaterial3dPreset } from "./material3dPresets";

// PBR material used for annotation solids under realistic lighting (live
// "Réaliste" / "Photoréaliste" viewport modes).
// Matte, non-metallic surface; translucent annotations use PHYSICAL
// transmission (deterministic via transmissiveBounces in the path tracer)
// instead of stochastic alpha which produces banding artefacts.
const ANNOTATION_ROUGHNESS = 0.85;

export function createAnnotationPbrMaterial({
  color,
  opacity = 1,
  map = null,
  alphaMap = null,
  side,
  transparent = false,
}) {
  if (opacity < 1) {
    return new MeshPhysicalMaterial({
      color,
      map,
      side,
      roughness: ANNOTATION_ROUGHNESS,
      metalness: 0,
      transmission: 1 - opacity,
      thickness: 0,
      ior: 1,
    });
  }
  return new MeshStandardMaterial({
    color,
    map,
    alphaMap,
    opacity,
    transparent,
    side,
    roughness: ANNOTATION_ROUGHNESS,
    metalness: 0,
  });
}

// PHOTOREAL material for annotations carrying a `material3d` preset key
// (béton, résine, gravier…). Texture maps load async and land on the SAME
// material instance (needsUpdate), so the hover/dim restore path
// (userData.originalMaterial) and material.clone() callers keep working.
export function createMaterial3dMaterial({
  presetKey,
  color,
  opacity = 1,
  side,
  onMapsLoaded,
}) {
  const preset = getMaterial3dPreset(presetKey);
  if (!preset) return createAnnotationPbrMaterial({ color, opacity, side });

  // Translucent annotations keep the stable transmission recipe (no maps —
  // a transmissive textured surface reads as dirty glass), with only the
  // preset's scalar roughness applied.
  if (opacity < 1) {
    return new MeshPhysicalMaterial({
      color,
      side,
      roughness: preset.roughness ?? ANNOTATION_ROUGHNESS,
      metalness: preset.metalness ?? 0,
      transmission: 1 - opacity,
      thickness: 0,
      ior: 1,
    });
  }

  const material = new MeshPhysicalMaterial({
    color: preset.tint ? color : new Color(0xffffff),
    side,
    roughness: preset.roughness ?? ANNOTATION_ROUGHNESS,
    metalness: preset.metalness ?? 0,
    clearcoat: preset.clearcoat ?? 0,
    clearcoatRoughness: preset.clearcoatRoughness ?? 0,
  });

  if (preset.textures) {
    // Flagged synchronously so the finishing pass (AnnotationsManager) box-
    // projects world-scale UVs before the maps even arrive. Both flags are
    // deep-copied by material.clone(), so clones qualify for the finishing
    // pass too (ensureMaterial3dMaps attaches their maps there).
    material.userData.material3dNeedsBoxUvs = true;
    material.userData.material3dPresetKey = presetKey;
    ensureMaterial3dMaps(material, onMapsLoaded);
  }

  return material;
}
