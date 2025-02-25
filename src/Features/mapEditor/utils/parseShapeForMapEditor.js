import parsePointsFromStateToNode from "Features/mapEditor/js/utilsShapesManager/parsePointsFromStateToNode";

export default function parseShapeForMapEditor(shape, mapEditor) {
  const imageNode = mapEditor.imagesManager.mainImageNode;
  const imageSize = {width: imageNode.width(), height: imageNode.height()};
  const imagePosition = {x: imageNode.x(), y: imageNode.y()};

  return {
    ...shape,
    points: parsePointsFromStateToNode(shape.points, imageSize, imagePosition),
  };
}
