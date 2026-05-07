// Per-annotation-type registry of available 3D shape variants.
//
// `null` (or absent) means "default 3D construction" (existing behavior in
// createAnnotationObject3D). Otherwise, `annotation.shape3D` is an OBJECT of
// the form `{ key, ...payload }` — e.g. `{ key: "REVOLUTION" }` or
// `{ key: "EXTRUSION_PROFILE", profileTemplateId }`. The object form lets
// shape variants carry extra parameters (template references, options, etc.)
// without inflating the annotation schema.
//
// Keyed by annotation TYPE (not drawingShape) so types that share a drawing
// tool can diverge later (e.g. STRIP vs POLYLINE). The static entries below
// list the per-type built-in shapes; dynamic shapes (profiles) are sourced
// at runtime by `Shape3DSelector` and added to the menu directly.

const SHAPE_3D_CONFIG = {
  POLYLINE: [
    { key: "REVOLUTION", label: "Révolution" },
  ],
  STRIP: [],
};

export const SHAPE_3D_KEYS = {
  REVOLUTION: "REVOLUTION",
  EXTRUSION_PROFILE: "EXTRUSION_PROFILE",
};

// Annotation types that support EXTRUSION_PROFILE (dynamic profile shapes).
// The selector adds the dynamic "Profils" section only for these types.
export const TYPES_SUPPORTING_PROFILES = ["POLYLINE", "STRIP"];

export function getShape3DOptionsForType(annotationType) {
  return SHAPE_3D_CONFIG[annotationType] ?? [];
}

export function getShape3DEntry(annotationType, key) {
  return getShape3DOptionsForType(annotationType).find((o) => o.key === key) ?? null;
}

// Read the discriminator key of a shape3D value. Accepts the object form
// `{ key, ... }` only (the previous string form is no longer supported).
export function getShape3DKey(shape3D) {
  return shape3D?.key ?? null;
}

export default SHAPE_3D_CONFIG;
