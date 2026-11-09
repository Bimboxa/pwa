import getBaseMapTransform, {
  getBaseMapEuler,
  BASE_MAP_ROTATION_ORDER,
} from "Features/baseMaps/js/getBaseMapTransform";

import getBaseMapForRender from "../utilsAnnotationsManager/getBaseMapForRender";

export function getEditorMeterByPx(map) {
  return map.scene3d?.relativeToBaseMap
    ? getBaseMapForRender(map).meterByPx
    : map.meterByPx;
}

// Annotation coordinates live in the REFERENCE frame (refWidth/refHeight —
// see BaseMap.getImageSize): the active version's image may have a different
// pixel size and is placed into that frame by the version transform, exactly
// like the 2D SVG does in StaticMapContent. meterByPx is per REFERENCE-frame
// pixel, so the group's local meter frame (widthInM/heightInM) is the
// reference frame too; the version placement is baked into the plane
// geometry (see buildBaseMapPlaneGeometry).
export default function getEditorImageFromBaseMap(map) {
  const t = getBaseMapTransform(map);
  const rotation = getBaseMapEuler(t);
  const refSizePx = map.getImageSize?.() || map.image?.imageSize;
  const meterByPx = getEditorMeterByPx(map);
  const versionSizePx = map.image?.imageSize;
  const versionTransform = map.getActiveVersionTransform?.() || {
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
  };
  return {
    id: map.id,
    url: map.image?.imageUrlClient,
    widthInM: refSizePx?.width * meterByPx,
    heightInM: refSizePx?.height * meterByPx,
    meterByPx,
    refSizePx,
    versionSizePx,
    versionTransform,
    position: t.position,
    rotation,
    rotationOrder: BASE_MAP_ROTATION_ORDER,
  };
}
