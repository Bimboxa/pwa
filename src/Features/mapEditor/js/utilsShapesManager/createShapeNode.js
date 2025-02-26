import Konva from "konva";

import getPointsFlatArray from "./getPointsFlatArray";

import theme from "Styles/theme";
import parsePointsFromStateToNode from "./parsePointsFromStateToNode";

export default function createShapeNode({shape, stageScale, imageNode}) {
  // helper - color

  let color = shape.color ?? theme.palette.shape.default;
  if (shape.selected) color = theme.palette.shape.selected;

  // helper - points

  const imageSize = {width: imageNode.width(), height: imageNode.height()};
  const imagePosition = {x: imageNode.x(), y: imageNode.y()};

  const points = parsePointsFromStateToNode(
    shape.points,
    imageSize,
    imagePosition
  );

  // node

  const shapeNode = new Konva.Line({
    points,
    stroke: color,
    fill: color,
    opacity: 0.8,
    strokeWidth: 2 / stageScale,
    closed: true,
  });

  // return

  return shapeNode;
}
