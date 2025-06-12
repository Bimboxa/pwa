import theme from "Styles/theme";

export default function createMarkerNode({marker, stageScale, imageNode}) {
  // helper - id

  if ((!marker.id && !marker.isTemp) || !imageNode) return;
  const id = marker.id;

  // helper - color

  let color = marker.color ?? theme.palette.marker.default;

  // helper - points

  const imageSize = {width: imageNode.width(), height: imageNode.height()};
  const imagePosition = {x: imageNode.x(), y: imageNode.y()};

  const markerX = isNaN(marker.x) ? 0 : marker.x;
  const markerY = isNaN(marker.y) ? 0 : marker.y;

  const x = markerX * imageSize.width + imagePosition.x;
  const y = markerY * imageSize.height + imagePosition.y;

  // node

  const shapeNode = new Konva.Circle({
    id,
    x,
    y,
    radius: 16 / stageScale,
    fill: color,
    opacity: 0.8,
    draggable: true,
  });

  return shapeNode;
}
