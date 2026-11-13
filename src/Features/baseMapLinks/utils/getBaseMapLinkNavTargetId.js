// The base map a section mark (BASE_MAP_LINK) leads to, or null:
// - the mark on its plan → the vertical base map it is located on
//   (`linkedBaseMapId`);
// - its clone on that vertical base map → the plan hosting the mark
//   (`sourceLinkBaseMapId`, stamped at read time by useAnnotationsV2).
// A click on the label / arrows of the mark opens that base map (2D node,
// 3D sprites); the hover tooltip previews it (MapTooltip).
export default function getBaseMapLinkNavTargetId(annotation) {
  if (annotation?.type !== "BASE_MAP_LINK") return null;
  return (
    (annotation.sourceLinkAnnotationId
      ? annotation.sourceLinkBaseMapId
      : annotation.linkedBaseMapId) ?? null
  );
}
