import NodeMarkerStatic from "./NodeMarkerStatic";
import NodePolylineStatic from "./NodePolylineStatic";
import NodeStripStatic from "./NodeStripStatic";
import NodeTextStatic from "./NodeTextStatic";
import NodeLabelStatic from "./NodeLabelStatic";
import NodeImageStatic from "./NodeImageStatic";
import NodeObject3DStatic from "./NodeObject3DStatic";
import NodePointStatic from "./NodePointStatic";
import NodeRectangleStatic from "./NodeRectangleStatic";

import resolveAnnotationDefaults from "Features/annotations/utils/resolveAnnotationDefaults";

export default function NodeAnnotationStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  selectedPointId,
  selectedPointIds,
  selectedPartId,
  dragged,
  baseMapMeterByPx,
  baseMapImageScale = 1,
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
  selectMode,

}) {
  annotation = { ...annotation ?? {}, ...annotationOverride ?? {} };

  // Apply shape-based defaults for any missing style properties
  annotation = resolveAnnotationDefaults(annotation);

  const props = {
    hovered,
    selected,
    selectedPointId,
    selectedPointIds,
    selectedPartId,
    dragged,
    baseMapMeterByPx,
    baseMapImageScale,
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
    selectMode,
  };

  // Note: point-based types (POLYGON, POLYLINE, STRIP) store their points
  // at the final rotated positions in the DB. The annotation.rotation field
  // is metadata used only for wrapper bbox computation — no SVG rotation
  // should be applied here (it would cause double rotation).

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

    case "OBJECT_3D":
      return <NodeObject3DStatic {...props} annotation={annotation} />;

    default:
      return null;
  }
}
