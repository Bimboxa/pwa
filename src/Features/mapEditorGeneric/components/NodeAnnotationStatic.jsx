import { memo, useMemo } from "react";

import NodeMarkerStatic from "./NodeMarkerStatic";
import NodePolylineStatic from "./NodePolylineStatic";
import NodeStripStatic from "./NodeStripStatic";
import NodeTextStatic from "./NodeTextStatic";
import NodeLabelStatic from "./NodeLabelStatic";
import NodeFreeTextStatic from "./NodeFreeTextStatic";
import NodeDetailStatic from "./NodeDetailStatic";
import NodeImageStatic from "./NodeImageStatic";
import NodeObject3DStatic from "./NodeObject3DStatic";
import NodePointStatic from "./NodePointStatic";
import NodeOpeningStatic from "./NodeOpeningStatic";
import NodeRectangleStatic from "./NodeRectangleStatic";
import NodeCoteStatic from "./NodeCoteStatic";
import NodeLinearLayoutStatic from "./NodeLinearLayoutStatic";
import NodeRulerStatic from "./NodeRulerStatic";
import NodePhotoStatic from "./NodePhotoStatic";
import NodeRevolutionAxisStatic from "./NodeRevolutionAxisStatic";
import NodeRevolutionAxisPlacementStatic from "./NodeRevolutionAxisPlacementStatic";

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
      // OPENING: template-driven wall opening (2-point POLYLINE glued on a
      // host wall) — dedicated band + jamb-ticks renderer.
      if (
        resolvedAnnotation.drawingShape === "OPENING" ||
        (resolvedAnnotation.isOpening && resolvedAnnotation.points?.length === 2)
      ) {
        return <NodeOpeningStatic {...props} annotation={resolvedAnnotation} />;
      }
      return <NodePolylineStatic {...props} annotation={resolvedAnnotation} />;

    case "STRIP":
      return <NodeStripStatic {...props} annotation={resolvedAnnotation} />;

    // LINEAR_LAYOUT: calepinage linéaire — band + axis + bar ticks from a
    // 2-point segment (the bottom edge of the band).
    case "LINEAR_LAYOUT":
      return (
        <NodeLinearLayoutStatic {...props} annotation={resolvedAnnotation} />
      );

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

    // FREE_TEXT: free text box (constant screen size, optional connector).
    // Deliberately ignores forceHideLabel — it renders in the main pass of
    // StaticMapContent (which passes forceHideLabel=true to every node), not
    // in the hoisted labels pass.
    case "FREE_TEXT":
      return <NodeFreeTextStatic {...props} annotation={resolvedAnnotation} />;

    // PHOTO: read-only camera pose (dot + view cone) synthesized from
    // db.photos by useAnnotationsV2 (`withPhotos`, Photos module).
    case "PHOTO":
      return <NodePhotoStatic {...props} annotation={resolvedAnnotation} />;

    // DETAIL: bubble + label + orientable arrow whose tip is the stored point.
    case "DETAIL":
      return <NodeDetailStatic {...props} annotation={resolvedAnnotation} />;

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

    // RULER: dimension CHAIN — the drawn polyline plus one cote per segment,
    // aligned on a single draggable offset line.
    case "RULER":
      return <NodeRulerStatic {...props} annotation={resolvedAnnotation} />;

    // Revolution helpers: the axis is authored on the plan as a circle split
    // into two half-discs; its placement on a vertical base map is an
    // inverted T (diameter + axis height).
    case "REVOLUTION_AXIS":
      return (
        <NodeRevolutionAxisStatic {...props} annotation={resolvedAnnotation} />
      );

    case "REVOLUTION_AXIS_PLACEMENT":
      return (
        <NodeRevolutionAxisPlacementStatic
          {...props}
          annotation={resolvedAnnotation}
        />
      );

    default:
      return null;
  }
}

export default memo(NodeAnnotationStatic);
