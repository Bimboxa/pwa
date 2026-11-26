// Per-dimension padlocks of a RECTANGLE template.
//
// A template stores its dimensions in `size {width, height}` (Lx / Ly, in
// `sizeUnit`) and its padlocks in `overrideFields`:
//   - "sizeWidth"  → Lx is driven by the template
//   - "sizeHeight" → Ly is driven by the template
//   - "size"       → legacy key, both dimensions
// A locked dimension is forced onto every annotation of the template at read
// time (getAnnotationPropsFromAnnotationTemplateProps) and cannot be resized.
// An unlocked dimension is only the default value used at placement.
//
// Pure module (no imports): shared by the node, the drag preview, the
// commits, the drawing layer and the template form.

export const RECTANGLE_LOCK_WIDTH_KEY = "sizeWidth";
export const RECTANGLE_LOCK_HEIGHT_KEY = "sizeHeight";
const LEGACY_LOCK_KEY = "size";

function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}

export default function getRectangleSizeLocks(templateProps) {
  const overrideFields = templateProps?.overrideFields;
  const size = templateProps?.size;
  if (!Array.isArray(overrideFields) || !size) {
    return { lockedWidth: false, lockedHeight: false };
  }
  const both = overrideFields.includes(LEGACY_LOCK_KEY);
  return {
    lockedWidth:
      (both || overrideFields.includes(RECTANGLE_LOCK_WIDTH_KEY)) &&
      isPositive(size.width),
    lockedHeight:
      (both || overrideFields.includes(RECTANGLE_LOCK_HEIGHT_KEY)) &&
      isPositive(size.height),
  };
}
