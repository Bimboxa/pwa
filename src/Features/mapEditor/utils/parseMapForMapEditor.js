export default function parseMapForMapEditor(map, options) {
  // edge case

  if (!map) return null;

  // options

  const nodeType = options?.nodeType;

  // main
  const image = {
    id: map.id,
    url: map.imageUrl,
    width: map.imageWidth,
    height: map.imageHeight,
    x: 0,
    y: 0,
    nodeType: nodeType ?? "MAP",
  };

  return image;
}
