import parsePointsFromNodeToState from "./parsePointsFromNodeToState";

export default function parseShapeFromNodeToState(shapeNode, props) {
  // main

  const shape = {
    ...props,
    points: parsePointsFromNodeToState(
      shapeNode.points,
      {width: imageWidth, height: imageHeight},
      {x: 0, y: 0}
    ),
  };

  return shape;
}
