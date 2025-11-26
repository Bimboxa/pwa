export default function getEditorImageFromBaseMap(map) {
  // defaults

  const defaultRotation = {
    x: -Math.PI / 2,
    y: 0,
    z: 0,
  };
  return {
    id: map.id,
    url: map.image?.imageUrlClient,
    widthInM: map.image?.imageSize.width * map.meterByPx,
    heightInM: map.image?.imageSize.height * map.meterByPx,
    rotation: map.rotation ?? defaultRotation,
  };
}
