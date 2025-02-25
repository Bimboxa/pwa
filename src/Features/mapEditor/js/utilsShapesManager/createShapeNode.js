import Konva from "konva";

import getPointsFlatArray from "./getPointsFlatArray";

import theme from "Styles/theme";

export default function createShapeNode({shape, stageScale}) {
  // helper

  let color = shape.color;
  if (shape.selected) color = theme.palette.shape.selected;

  // node

  const shapeNode = new Konva.Line({
    points,
    stroke: color,
    fill: color,
    strokeWidth: 2 / stageScale,
    closed: true,
  });

  // return

  return shapeNode;
}
