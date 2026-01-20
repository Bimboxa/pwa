import NodeMarkerStatic from "./NodeMarkerStatic";
import NodePolylineStatic from "./NodePolylineStatic";
import NodeStripStatic from "./NodeStripStatic";
import NodeTextStatic from "./NodeTextStatic";
import NodeLabelStatic from "./NodeLabelStatic";
import NodeImageStatic from "./NodeImageStatic";
import NodePointStatic from "./NodePointStatic";
import NodeRectangleStatic from "./NodeRectangleStatic";

export default function NodeAnnotationStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  selectedPointId,
  selectedPartId,
  dragged,
  baseMapMeterByPx,
  spriteImage,
  imageSize, // for text annotations
  containerK,
  sizeVariant,
  showBgImage,
  context, // BG_IMAGE or BASE_MAP
  printMode,
  onTextValueChange,
  forceHideLabel,
  highlightConnectedSegments,

}) {
  annotation = { ...annotation ?? {}, ...annotationOverride ?? {} };

  const props = {
    hovered,
    selected,
    selectedPointId,
    selectedPartId,
    dragged,
    baseMapMeterByPx,
    spriteImage,
    containerK,
    sizeVariant,
    imageSize,
    showBgImage,
    context,
    onTextValueChange,
    printMode,
    forceHideLabel,
    highlightConnectedSegments,
  };

  switch (annotation.type) {
    case "MARKER":
      return <NodeMarkerStatic {...props} marker={annotation} />;

    case "POINT":
      return <NodePointStatic {...props} annotation={annotation} />;

    case "POLYGON":
      return <NodePolylineStatic {...props} annotation={annotation} />;

    case "POLYLINE":
      return <NodePolylineStatic {...props} annotation={annotation} />;

    case "STRIP":
      return <NodeStripStatic {...props} annotation={annotation} />;

    case "TEXT":
      return <NodeTextStatic {...props} text={annotation} />;

    case "LABEL":
      return <NodeLabelStatic {...props} annotation={annotation} sizeVariant="FIXED_IN_BG_IMAGE" />;

    case "RECTANGLE":
      return <NodeRectangleStatic {...props} annotation={annotation} />;

    // case "SEGMENT":
    //   return NodeSegment({ ...props, segment: annotation });

    case "IMAGE":
      return <NodeImageStatic {...props} imageAnnotation={annotation} />;

    default:
      return null;
  }
}
