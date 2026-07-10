import { MeshStandardMaterial, MeshPhysicalMaterial } from "three";

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
