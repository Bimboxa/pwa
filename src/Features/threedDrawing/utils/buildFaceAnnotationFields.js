import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";

// Keys owned by the face geometry/classification or the commit service —
// never taken from the template-armed newAnnotation.
const NON_TEMPLATE_KEYS = new Set([
  "id",
  "type",
  "points",
  "cuts",
  "innerPoints",
  "point",
  "bbox",
  "drawingShape",
  "offsetZ",
  "height",
  "closeLine",
  "baseMapId",
  "projectId",
  "listingId",
  "entityId",
  "layerId",
  "isOpening",
  "guideLines",
  "hiddenSegmentsIdx",
  "rotation",
  "rotationCenter",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

// Pure merge of the annotation style fields for a face drawn in 3D:
// shape defaults < template props < classification-driven geometry fields.
// The geometric classification of the face vs the host baseMap always wins
// on type/offsetZ/height/closeLine, even when it differs from the template's
// drawingShape (e.g. a POLYGON template drawing a vertical face commits a
// closed POLYLINE wall).
export default function buildFaceAnnotationFields({
  classifiedShape, // "POLYGON" | "POLYLINE" — drives the defaults
  classificationFields, // { type, offsetZ, height, closeLine? }
  templateProps = null, // the template-armed newAnnotation (or null)
}) {
  const defaults = getDefaultsForShape(classifiedShape);
  if (!templateProps) return { ...defaults, ...classificationFields };

  const sanitized = {};
  for (const [key, value] of Object.entries(templateProps)) {
    if (NON_TEMPLATE_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;
    sanitized[key] = value;
  }

  const fields = { ...defaults, ...sanitized, ...classificationFields };

  // Cross-shape color rules. A POLYGON template only carries a meaningful
  // fillColor (its strokeColor is a generic shape default) and the 3D wall
  // color resolves to strokeColor || fillColor — so a vertical face drawn
  // with a POLYGON template takes the template fill as its stroke. Mirror
  // rule for a POLYLINE template committing a POLYGON.
  const templateShape = templateProps.drawingShape;
  if (
    classifiedShape === "POLYLINE" &&
    templateShape === "POLYGON" &&
    templateProps.fillColor
  ) {
    fields.strokeColor = templateProps.fillColor;
  }
  if (
    classifiedShape === "POLYGON" &&
    templateShape === "POLYLINE" &&
    templateProps.strokeColor
  ) {
    fields.fillColor = templateProps.strokeColor;
  }

  return fields;
}
