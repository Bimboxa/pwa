import getAnnotationTemplateProps from "./getAnnotationTemplateProps";
import getAnnotationPropsFromAnnotationTemplateProps from "./getAnnotationPropsFromAnnotationTemplateProps";
import getAnnotationTypeOnTemplateChange from "./getAnnotationTypeOnTemplateChange";
import getEffectiveAnnotationType from "./getEffectiveAnnotationType";
import { getGeometryKindFromType } from "../constants/drawingShapeConfig";

// Read-time fields (useAnnotationsV2 / the template merge) that must never
// reach the DB row.
const DERIVED_FIELDS = new Set(["annotationTemplateProps", "annotationLabel"]);

// The DB patch to apply when `annotation` switches to `template`.
//
// `annotation` may be the RESOLVED row (toolbar: useSelectedAnnotation —
// pixel points, baseMapName, embedded annotationTemplate, ...) or the raw DB
// record (context menu). Only the fields the template merge actually changed
// are written, never the whole object: persisting a resolved row used to
// store pixel geometry and derived fields verbatim and, combined with a
// cross-family type switch, produced rows the resolver cannot read.
export default function getAnnotationTemplateChangeUpdates({
  annotation,
  template,
  baseMap,
}) {
  if (!template || !annotation?.id) return null;

  const templateProps = getAnnotationTemplateProps(template);

  // Only overwrite properties the template locks (overrideFields);
  // non-overridden fields keep the annotation's own value.
  const merged = getAnnotationPropsFromAnnotationTemplateProps(
    annotation,
    templateProps,
    baseMap
  );

  // bbox only exists for the BBOX family (IMAGE / RECTANGLE / OBJECT_3D);
  // the merge builds one from a template `size` whatever the annotation is.
  const geometryKind = getGeometryKindFromType(
    getEffectiveAnnotationType(annotation)
  );

  const updates = {};
  for (const [key, value] of Object.entries(merged)) {
    if (DERIVED_FIELDS.has(key)) continue;
    if (key === "bbox" && geometryKind !== "BBOX") continue;
    if (value === annotation[key]) continue;
    updates[key] = value;
  }

  // `type` is a STRIP_MEDIAN_FIELDS key (useUpdateAnnotation reflows the
  // glued openings on it): only written when it actually changes.
  const resolvedType = getAnnotationTypeOnTemplateChange(annotation, template);
  if (resolvedType && resolvedType !== annotation.type) {
    updates.type = resolvedType;
  }

  return {
    ...updates,
    id: annotation.id,
    annotationTemplateId: template.id,
    templateLabel: template.label,
    listingId: template.listingId,
    // Persist the NEW template's lock set so the editor UI reflects it.
    overrideFields: templateProps.overrideFields,
  };
}
