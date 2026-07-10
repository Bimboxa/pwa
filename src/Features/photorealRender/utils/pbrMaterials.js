import { MeshStandardMaterial, MeshPhysicalMaterial } from "three";

// PBR material used for annotation solids under realistic lighting (live
// "Réaliste" / "Photoréaliste" viewport modes AND the photoreal export).
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

// Walk the scene and replace each annotation material with a PBR material,
// so the path-tracer can compute proper lighting / shadows / GI.
// Handles both MeshBasicMaterial (OBJECT_3D / GLB annotations) and
// MeshLambertMaterial (the canonical solid-annotation material — POLYGON /
// RECTANGLE / STRIP / WALL / REVOLUTION / EXTRUSION_PROFILE). The Lambert
// emissive/emissiveIntensity lift is deliberately dropped: it's a real-time
// shading hack, and under the path tracer's white environment we want true
// lighting, not self-illumination.
// Texture maps are preserved. Basemap meshes (tagged userData.isBasemap) are
// skipped — they're rendered separately in a raster pass and composited under
// the path-trace. Materials already built as PBR (live realistic modes) pass
// through untouched, so the export behaves the same from any render mode.
export function swapToPbrMaterials(scene) {
  const originals = new Map();
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    if (Array.isArray(obj.material)) return;
    if (
      !obj.material.isMeshBasicMaterial &&
      !obj.material.isMeshLambertMaterial
    )
      return;
    if (obj.userData?.isBasemap) return;

    const src = obj.material;
    originals.set(obj, src);

    const opacity =
      src.transparent && (src.opacity ?? 1) < 1 ? (src.opacity ?? 1) : 1;
    obj.material = createAnnotationPbrMaterial({
      color: src.color.clone(),
      opacity,
      map: src.map ?? null,
      alphaMap: src.alphaMap ?? null,
      side: src.side,
      transparent: src.transparent,
    });
  });
  return () => {
    originals.forEach((mat, obj) => {
      obj.material.dispose();
      obj.material = mat;
    });
  };
}
