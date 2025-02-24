import Konva from "konva";

import getPointsFlatArray from "./getPointsFlatArray";

import theme from "Styles/theme";

export default function createShapeNode({shape, stageScale, onClick}) {
  // helper

  const points = getPointsFlatArray(shape.points, {scaleBy: 1 / stageScale});

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

  // listeners

  shapeNode.on("click", () => {
    console.log("[createShapeNode] click", shape);
    if (onClick) onClick(shape);
  });

  // return

  return shapeNode;
}
