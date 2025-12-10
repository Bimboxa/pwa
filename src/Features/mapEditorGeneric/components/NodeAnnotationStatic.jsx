import NodeMarkerStatic from "./NodeMarkerStatic";
import NodePolylineStatic from "./NodePolylineStatic";
import NodeTextStatic from "./NodeTextStatic";

export default function NodeAnnotationStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  dragged,
  baseMapMeterByPx,
  spriteImage,
  imageSize, // for text annotations
  containerK,
  sizeVariant,
}) {
  annotation = { ...annotation ?? {}, ...annotationOverride ?? {} };

  const props = {
    hovered,
    selected,
    dragged,
    baseMapMeterByPx,
    spriteImage,
    containerK,
    sizeVariant,
    imageSize,
  };

  switch (annotation.type) {
    case "MARKER":
      return <NodeMarkerStatic {...props} marker={annotation} />;

    case "POLYGON":
      return <NodePolylineStatic {...props} annotation={annotation} />;

    case "POLYLINE":
      return <NodePolylineStatic {...props} annotation={annotation} />;

    case "TEXT":
      return <NodeTextStatic {...props} text={annotation} />;

    // case "RECTANGLE":
    //   return NodeRectangle({ ...props, rectangle: annotation });

    // case "SEGMENT":
    //   return NodeSegment({ ...props, segment: annotation });

    // case "IMAGE":
    //   return NodeImageAnnotation({ ...props, imageAnnotation: annotation });

    default:
      return null;
  }
}
