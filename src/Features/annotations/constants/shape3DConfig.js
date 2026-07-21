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

// REVOLUTION is no longer a static self-axis option: it is now driven by a
// referenced REVOLUTION_AXIS annotation (shape3D = { key: "REVOLUTION",
// axisAnnotationId }). The Shape3DSelector adds a dynamic "Révolution" section
// listing the available axes, so there are no static POLYLINE entries here.
//
// POLYGON shell shapes (coques) only make sense when the polygon carries
// profileLines — `isAvailable` gates the menu entries accordingly.
const hasShellProfiles = (annotation) =>
  !!annotation?.profileLines?.some((l) => (l?.points?.length ?? 0) >= 2);

const SHAPE_3D_CONFIG = {
  POLYLINE: [],
  STRIP: [],
  POLYGON: [
    {
      key: "SHELL_DOME",
      label: "Coque — Dôme",
      isAvailable: hasShellProfiles,
    },
    {
      key: "SHELL_TENT",
      label: "Coque — Tente",
      isAvailable: hasShellProfiles,
    },
  ],
};

// Annotation types that support the dynamic "Révolution" section (axis-based).
export const TYPES_SUPPORTING_REVOLUTION = ["POLYLINE"];

export const SHAPE_3D_KEYS = {
  REVOLUTION: "REVOLUTION",
  EXTRUSION_PROFILE: "EXTRUSION_PROFILE",
  SHELL_DOME: "SHELL_DOME",
  SHELL_TENT: "SHELL_TENT",
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

// Effective shell mode for a POLYGON with profileLines: null when no
// profiles; the explicit SHELL_TENT choice; otherwise DOME (the DEFAULT even
// when shape3D is unset). Used by the 3D build and the qties path.
export function getEffectiveShellMode(annotation) {
  if (!hasShellProfiles(annotation)) return null;
  return getShape3DKey(annotation?.shape3D) === SHAPE_3D_KEYS.SHELL_TENT
    ? "TENT"
    : "DOME";
}

export default SHAPE_3D_CONFIG;
