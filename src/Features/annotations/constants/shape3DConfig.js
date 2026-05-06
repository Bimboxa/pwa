// Per-annotation-type registry of available 3D shape variants.
//
// `null` means "default 3D construction" (existing behavior in
// createAnnotationObject3D). A non-null `shape3D` value on an annotation
// switches both the 3D rendering and the surface quantity calculation.
//
// Keyed by annotation TYPE (not drawingShape) so types that share a drawing
// tool can diverge later (e.g. STRIP vs POLYLINE).

const SHAPE_3D_CONFIG = {
  POLYLINE: [
    { key: "REVOLUTION", label: "Révolution" },
  ],
};

export const SHAPE_3D_KEYS = {
  REVOLUTION: "REVOLUTION",
};

export function getShape3DOptionsForType(annotationType) {
  return SHAPE_3D_CONFIG[annotationType] ?? [];
}

export function getShape3DEntry(annotationType, key) {
  return getShape3DOptionsForType(annotationType).find((o) => o.key === key) ?? null;
}

export default SHAPE_3D_CONFIG;
