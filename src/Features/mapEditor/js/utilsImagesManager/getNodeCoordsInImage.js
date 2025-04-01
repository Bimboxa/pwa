export default function getNodeCoordsInImage(node, imageNode) {
  const x = (node.x() - imageNode.x()) / imageNode.width();
  const y = (node.y() - imageNode.y()) / imageNode.height();
  return {x, y};
}
