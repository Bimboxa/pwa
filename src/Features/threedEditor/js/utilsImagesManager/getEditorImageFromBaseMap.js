import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";

export default function getEditorImageFromBaseMap(map) {
  const { position, rotation } = getBaseMapTransform(map);
  return {
    id: map.id,
    url: map.image?.imageUrlClient,
    widthInM: map.image?.imageSize.width * map.meterByPx,
    heightInM: map.image?.imageSize.height * map.meterByPx,
    position,
    rotation,
  };
}
