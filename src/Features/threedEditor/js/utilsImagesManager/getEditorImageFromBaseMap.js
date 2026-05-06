import getBaseMapTransform, {
  getBaseMapEuler,
  BASE_MAP_ROTATION_ORDER,
} from "Features/baseMaps/js/getBaseMapTransform";

export default function getEditorImageFromBaseMap(map) {
  const t = getBaseMapTransform(map);
  const rotation = getBaseMapEuler(t);
  return {
    id: map.id,
    url: map.image?.imageUrlClient,
    widthInM: map.image?.imageSize.width * map.meterByPx,
    heightInM: map.image?.imageSize.height * map.meterByPx,
    position: t.position,
    rotation,
    rotationOrder: BASE_MAP_ROTATION_ORDER,
  };
}
