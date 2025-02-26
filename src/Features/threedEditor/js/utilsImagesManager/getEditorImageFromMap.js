export default function getEditorImageFromMap(map) {
  // defaults

  const defaultRotation = {
    x: -Math.PI / 2,
    y: 0,
    z: 0,
  };
  return {
    id: map.id,
    url: map.imageUrl,
    widthInM: map.imageWidth * map.meterByPx,
    heightInM: map.imageHeight * map.meterByPx,
    rotation: map.rotation ?? defaultRotation,
  };
}
