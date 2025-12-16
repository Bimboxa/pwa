import NodePolygon from "./NodePolygon";
import NodeText from "./NodeText";
import NodeMarker from "./NodeMarker";
import NodePolyline from "./NodePolyline";
import NodeRectangle from "./NodeRectangle";
import NodeSegment from "./NodeSegment";
import NodeImageAnnotation from "./NodeImageAnnotation";

export default function NodeAnnotation({
  annotation,
  spriteImage,
  imageSize,
  baseMapMeterByPx,
  containerK,
  worldScale,
  onDragStart,
  onDragEnd,
  onChange,
  onClick,
  selected,
  edited = false,
  onPolylineComplete,
  toBaseFromClient,
  hidden = false,
}) {
  const props = {
    spriteImage,
    imageSize,
    baseMapMeterByPx,
    containerK,
    worldScale,
    onChange,
    onDragStart,
    onDragEnd,
    onClick,
    selected,
    edited,
    onPolylineComplete,
    toBaseFromClient,
    hidden,
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

    case "SEGMENT":
      return NodeSegment({ ...props, segment: annotation });

    case "IMAGE":
      return NodeImageAnnotation({ ...props, imageAnnotation: annotation });

    default:
      return null;
  }
}
