import theme from "Styles/theme";

export default function createMarkerNode({marker, stageScale, imageNode}) {
  // helper - color

  let color = marker.color ?? theme.palette.marker.default;

  // helper - points

  const imageSize = {width: imageNode.width(), height: imageNode.height()};
  const imagePosition = {x: imageNode.x(), y: imageNode.y()};

  const x = marker.x * imageSize.width + imagePosition.x;
  const y = marker.y * imageSize.height + imagePosition.y;

  // node

  const shapeNode = new Konva.Circle({
    x,
    y,
    radius: 16 / stageScale,
    fill: color,
    opacity: 0.8,
    draggable: true,
  });

  return shapeNode;
}
