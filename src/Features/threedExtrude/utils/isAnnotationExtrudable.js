// 3D shapes whose volume is NOT driven by `annotation.height` — the edit
// toolbar hides the height field for them, so extruding would be a no-op.
const UNSUPPORTED_SHAPE_3D_KEYS = ["REVOLUTION", "EXTRUSION_PROFILE"];

// Whether the extrude tool may write `height` on this annotation.
//
// The template check mirrors `isLocked("height")` in ToolbarEditAnnotation:
// when a template lists "height" in `overrideFields` its value wins at read
// time (getAnnotationPropsFromAnnotationTemplateProps), so writing the
// annotation's own height would be silently ignored.
export default function isAnnotationExtrudable(annotation, annotationTemplate) {
  if (!annotation) return false;
  if (UNSUPPORTED_SHAPE_3D_KEYS.includes(annotation.shape3D?.key)) return false;
  const overrideFields = annotationTemplate?.overrideFields;
  if (Array.isArray(overrideFields) && overrideFields.includes("height")) {
    return false;
  }
  return true;
}
