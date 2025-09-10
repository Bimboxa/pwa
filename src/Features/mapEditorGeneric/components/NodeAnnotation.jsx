import NodePolygon from "./NodePolygon";
import NodeText from "./NodeText";
import NodeMarker from "./NodeMarker";

export default function NodeAnnotation({
  annotation,
  spriteImage,
  imageSize,
  containerK,
  worldScale,
  onDragEnd,
  onClick,
  selected,
}) {
  const props = {
    spriteImage,
    imageSize,
    containerK,
    worldScale,
    onDragEnd,
    onClick,
    selected,
  };
  switch (annotation.type) {
    case "MARKER":
      return NodeMarker({ ...props, marker: annotation });

    case "POLYGON":
      return NodePolygon({ ...props, polygon: annotation });

    case "TEXT":
      return NodeText({ ...props, text: annotation });

    default:
      return null;
  }
}
