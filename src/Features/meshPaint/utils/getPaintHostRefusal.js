// Why the « Pinceau » (MESH_BRUSH) refuses to paint a part — one place for
// the host rules (getPaintHostRefusal) and the French labels the cursor
// helper shows for every refusal reason (PAINT_REFUSAL_LABELS).
//
// Pure: node-testable, no imports.

export const PAINT_REFUSAL = Object.freeze({
  // host rules (getPaintHostRefusal)
  PHOTO_PLAN: "PHOTO_PLAN", // photo base map reconstruction (no base map group)
  OBJECT_3D: "OBJECT_3D", // imported model (GLB): no planar facets of its own
  IMAGE: "IMAGE", // picture plane
  CURVED_SHAPE: "CURVED_SHAPE", // REVOLUTION / EXTRUSION_PROFILE shells
  MESH_CELL: "MESH_CELL", // maille annotation (cells of a meshed parent)
  OWN_TEMPLATE: "OWN_TEMPLATE", // annotation of the armed template itself
  // part rules (picking)
  CURVED_SURFACE: "CURVED_SURFACE", // the clicked region is not planar
  INNER_FACE: "INNER_FACE", // inner side of a closed solid
  NOT_SOLID: "NOT_SOLID", // a decoration of the host, not its solid
  OCCLUDED: "OCCLUDED", // a maille hides the host under the cursor
  // context rules (commit impossible)
  NO_SCALE: "NO_SCALE", // base map without scale / image size
  READ_ONLY: "READ_ONLY", // private scope of another user
  LINKED_LISTING: "LINKED_LISTING", // template of a linked (read-only) listing
});

export const PAINT_REFUSAL_LABELS = Object.freeze({
  PHOTO_PLAN: "Annotation de photo non peignable",
  OBJECT_3D: "Objet 3D non peignable",
  IMAGE: "Image non peignable",
  CURVED_SHAPE: "Forme courbe non peignable",
  MESH_CELL: "Maille non peignable",
  OWN_TEMPLATE: "Annotation du modèle actif",
  CURVED_SURFACE: "Surface courbe",
  INNER_FACE: "Face intérieure",
  NOT_SOLID: "Partie non peignable",
  OCCLUDED: "Masqué par une maille",
  NO_SCALE: "Fond de plan sans échelle",
  READ_ONLY: "Plan de repérage en lecture seule",
  LINKED_LISTING: "Modèle d'une liste liée",
});

// Shapes built as curved shells (lathe / profile sweeps): their facets are
// tessellation artifacts, not parts.
const CURVED_SHAPE_KEYS = new Set(["REVOLUTION", "EXTRUSION_PROFILE"]);

const getShapeKey = (shape3D) =>
  typeof shape3D === "string" ? shape3D : (shape3D?.key ?? null);

/**
 * Host-level refusal of a brush target.
 *
 * @param {object} args
 * @param {object} [args.source] - the resolved annotation the host object was
 *   built from (AnnotationsManager.getAnnotationSource)
 * @param {object} [args.rootUserData] - userData of the host root (fallback
 *   for type / template when the source is unknown)
 * @param {boolean} [args.isUnderBaseMapGroup=true] - the root hangs under
 *   its base map group (false: photo plan reconstruction)
 * @param {string|null} [args.armedTemplateId] - the painting template
 * @returns {string|null} a PAINT_REFUSAL key, null when the host is paintable
 */
export default function getPaintHostRefusal({
  source,
  rootUserData,
  isUnderBaseMapGroup = true,
  armedTemplateId = null,
} = {}) {
  if (!isUnderBaseMapGroup || source?._photoPlan3D) {
    return PAINT_REFUSAL.PHOTO_PLAN;
  }
  const type = source?.type ?? rootUserData?.annotationType ?? null;
  if (type === "OBJECT_3D") return PAINT_REFUSAL.OBJECT_3D;
  if (type === "IMAGE") return PAINT_REFUSAL.IMAGE;
  if (CURVED_SHAPE_KEYS.has(getShapeKey(source?.shape3D))) {
    return PAINT_REFUSAL.CURVED_SHAPE;
  }
  if (source?.isMeshCell) return PAINT_REFUSAL.MESH_CELL;
  const templateId =
    source?.annotationTemplateId ?? rootUserData?.annotationTemplateId ?? null;
  if (armedTemplateId && templateId === armedTemplateId) {
    return PAINT_REFUSAL.OWN_TEMPLATE;
  }
  return null;
}

export function getPaintRefusalLabel(reason) {
  return PAINT_REFUSAL_LABELS[reason] ?? "Non peignable";
}
