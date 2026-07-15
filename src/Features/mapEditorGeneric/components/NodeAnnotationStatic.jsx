import { memo, useMemo } from "react";

import NodeMarkerStatic from "./NodeMarkerStatic";
import NodePolylineStatic from "./NodePolylineStatic";
import NodeStripStatic from "./NodeStripStatic";
import NodeTextStatic from "./NodeTextStatic";
import NodeLabelStatic from "./NodeLabelStatic";
import NodeImageStatic from "./NodeImageStatic";
import NodeObject3DStatic from "./NodeObject3DStatic";
import NodePointStatic from "./NodePointStatic";
import NodeRectangleStatic from "./NodeRectangleStatic";
import NodeCoteStatic from "./NodeCoteStatic";
import NodeRevolutionPointStatic from "./NodeRevolutionPointStatic";

import resolveAnnotationDefaults from "Features/annotations/utils/resolveAnnotationDefaults";

// Memoized with the default shallow compare. Callers must keep props
// id-derived or referentially stable — in particular pass
// `hovered={annotation.id === hoveredNode?.nodeId}` (a boolean computed from
// ids), never the hoveredNode object itself: a hover change then re-renders
// only the two nodes whose boolean flipped instead of every annotation.
function NodeAnnotationStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  selectedPointId,
  selectedPointIds,
  selectedPartId,
  selectedPartIds,
  dragged,
  draggedPartType,
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
  disableVertexEditing,
}) {
  // Apply the override + shape-based defaults ONCE per (annotation,
  // annotationOverride) pair. The memo keeps the resolved object
  // referentially stable across re-renders, so the memoized child
  // renderers (NodePolylineStatic & co) can skip work.
  const resolvedAnnotation = useMemo(
    () =>
      resolveAnnotationDefaults({
        ...(annotation ?? {}),
        ...(annotationOverride ?? {}),
      }),
    [annotation, annotationOverride]
  );

  const props = {
    hovered,
    selected,
    selectedPointId,
    selectedPointIds,
    selectedPartId,
    selectedPartIds,
    dragged,
    draggedPartType,
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
    disableVertexEditing,
  };

  // Note: point-based types (POLYGON, POLYLINE, STRIP) store their points
  // at the final rotated positions in the DB. The annotation.rotation field
  // is metadata used only for wrapper bbox computation — no SVG rotation
  // should be applied here (it would cause double rotation).

  switch (resolvedAnnotation.type) {
    case "MARKER":
      return <NodeMarkerStatic {...props} marker={resolvedAnnotation} />;

    case "POINT":
      return <NodePointStatic {...props} annotation={resolvedAnnotation} />;

    case "POLYGON":
      return <NodePolylineStatic {...props} annotation={resolvedAnnotation} />;

    case "POLYLINE":
      return <NodePolylineStatic {...props} annotation={resolvedAnnotation} />;

    case "STRIP":
      return <NodeStripStatic {...props} annotation={resolvedAnnotation} />;

    case "TEXT":
      return <NodeTextStatic {...props} text={resolvedAnnotation} />;

    case "LABEL":
      return (
        <NodeLabelStatic
          {...props}
          annotation={resolvedAnnotation}
          sizeVariant="FIXED_IN_BG_IMAGE"
        />
      );

    case "RECTANGLE":
      return <NodeRectangleStatic {...props} annotation={resolvedAnnotation} />;

    // case "SEGMENT":
    //   return NodeSegment({ ...props, segment: annotation });

    case "IMAGE":
      return (
        <NodeImageStatic {...props} imageAnnotation={resolvedAnnotation} />
      );

    case "OBJECT_3D":
      return <NodeObject3DStatic {...props} annotation={resolvedAnnotation} />;

    case "COTE":
      return <NodeCoteStatic {...props} annotation={resolvedAnnotation} />;

    // Revolution helpers: the elevation-view axis is a plain 2-point line
    // (reuses the canonical polyline renderer); the plan-view axis is a
    // cross-in-circle marker with a fixed 24px screen radius.
    case "REVOLUTION_AXIS":
      return <NodePolylineStatic {...props} annotation={resolvedAnnotation} />;

    case "REVOLUTION_POINT":
      return (
        <NodeRevolutionPointStatic {...props} annotation={resolvedAnnotation} />
      );

    default:
      return null;
  }
}

export default memo(NodeAnnotationStatic);
