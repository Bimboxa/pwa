import NodePolygon from "./NodePolygon";
import NodeText from "./NodeText";
import NodeMarker from "./NodeMarker";
import NodePolyline from "./NodePolyline";
import NodeRectangle from "./NodeRectangle";

export default function NodeAnnotation({
  annotation,
  spriteImage,
  imageSize,
  containerK,
  worldScale,
  onDragEnd,
  onChange,
  onClick,
  selected,
  onPolylineComplete,
  toBaseFromClient,
}) {
  const props = {
    spriteImage,
    imageSize,
    containerK,
    worldScale,
    onChange,
    onDragEnd,
    onClick,
    selected,
    onPolylineComplete,
    toBaseFromClient,
  };
  switch (annotation.type) {
    case "MARKER":
      return NodeMarker({ ...props, marker: annotation });

    case "POLYGON":
      return NodePolygon({ ...props, polygon: annotation });

    case "TEXT":
      return NodeText({ ...props, text: annotation });

    case "POLYLINE":
      return NodePolyline({ ...props, polyline: annotation });

    case "RECTANGLE":
      return NodeRectangle({ ...props, rectangle: annotation });

    default:
      return null;
  }
}
