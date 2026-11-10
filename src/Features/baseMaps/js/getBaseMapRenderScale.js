export function getBaseMapReferenceSize(baseMap) {
  return (
    baseMap.getImageSize?.() ??
    (baseMap.refWidth > 0 && baseMap.refHeight > 0
      ? { width: baseMap.refWidth, height: baseMap.refHeight }
      : baseMap.image?.imageSize)
  );
}

export function getGlbModelUnitsPerPx(baseMap) {
  const scene = baseMap.scene3d;
  if (scene?.format !== "GLB" || !scene.relativeToBaseMap) return null;
  const width = getBaseMapReferenceSize(baseMap)?.width;
  const modelWidth = scene.zone?.width;
  if (!(width > 0 && modelWidth > 0)) return null;
  const scale = modelWidth / width;
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}

// With no calibration, display the plan in the GLB's own units. Keep the
// stored metric scale separate so this fallback does not enable measurements.
export default function getBaseMapRenderScale(baseMap) {
  const scale = baseMap.meterByPx;
  if (Number.isFinite(scale) && scale > 0) return scale;
  return getGlbModelUnitsPerPx(baseMap) ?? scale;
}
