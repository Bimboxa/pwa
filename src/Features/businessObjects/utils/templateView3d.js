import { getQtyFormulaKey } from "./qtyFormula.js";

// 3D display of the annotations feeding a business object through one
// annotation template ("Affichage 3D" of the template card, "Quantités"
// tab) — applied by the 3D viewer while the object is SOLO (the annotation
// gets `_view3d`, see useBusinessObjectSoloAnnotations / useAnnotationsV2):
//
//   surface     — the usual geometry (wall strip, slab…)
//   topEdge     — POLYLINE: fat line along the top horizontal edge
//   bottomEdge  — POLYLINE: fat line along the bottom horizontal edge
//   outline     — POLYGON: fat line along the contour (outer ring + holes)
//
// A wall/floor junction is read by soloing a quantity linked to the walls
// with bottomEdge only; a perimeter by soloing one linked to the slab with
// outline only.
//
// Storage: businessObject.templateViews3d = [{annotationTemplateId, surface,
// topEdge, bottomEdge, outline}] — same approach as qtyFormulas: only the
// NON-default views are stored (no Dexie bump, whitelisted in
// useUpdateBusinessObject, remapped by the Krto import); annotationTemplateId
// null = annotations without template.

export const DEFAULT_TEMPLATE_VIEW3D = Object.freeze({
  surface: true,
  topEdge: false,
  bottomEdge: false,
  outline: false,
});

const VIEW_KEYS = ["surface", "topEdge", "bottomEdge", "outline"];

// Full view (every key a boolean) from a stored / edited item. Nothing shown
// at all is not a view: it falls back to the default (surface).
export function normalizeTemplateView3d(item) {
  const view = {};
  VIEW_KEYS.forEach((key) => {
    view[key] = Boolean(item?.[key]);
  });
  if (!VIEW_KEYS.some((key) => view[key]))
    return { ...DEFAULT_TEMPLATE_VIEW3D };
  return view;
}

export function isDefaultTemplateView3d(view) {
  const normalized = normalizeTemplateView3d(view);
  return VIEW_KEYS.every(
    (key) => normalized[key] === DEFAULT_TEMPLATE_VIEW3D[key]
  );
}

// {[getQtyFormulaKey(annotationTemplateId)]: view} of the NON-default views
// of the object, null when it has none.
export function getTemplateViews3dByTemplateId(businessObject) {
  const items = businessObject?.templateViews3d;
  if (!Array.isArray(items) || items.length === 0) return null;
  const byTemplateId = {};
  let hasView = false;
  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    if (isDefaultTemplateView3d(item)) return;
    byTemplateId[getQtyFormulaKey(item.annotationTemplateId)] =
      normalizeTemplateView3d(item);
    hasView = true;
  });
  return hasView ? byTemplateId : null;
}

// View of one template (defaults applied).
export function getTemplateView3d(businessObject, annotationTemplateId) {
  const byTemplateId = getTemplateViews3dByTemplateId(businessObject);
  return (
    byTemplateId?.[getQtyFormulaKey(annotationTemplateId)] ?? {
      ...DEFAULT_TEMPLATE_VIEW3D,
    }
  );
}

// Next businessObject.templateViews3d after editing the view of one template:
// a default view drops the entry.
export function setTemplateView3dForTemplate(
  templateViews3d,
  annotationTemplateId,
  view
) {
  const templateId = annotationTemplateId ?? null;
  const others = (Array.isArray(templateViews3d) ? templateViews3d : []).filter(
    (item) => (item?.annotationTemplateId ?? null) !== templateId
  );
  if (isDefaultTemplateView3d(view)) return others;
  return [
    ...others,
    { annotationTemplateId: templateId, ...normalizeTemplateView3d(view) },
  ];
}

// Next templateViews3d without the given template (template unlinked).
export function removeTemplateView3d(templateViews3d, annotationTemplateId) {
  return setTemplateView3dForTemplate(
    templateViews3d,
    annotationTemplateId,
    DEFAULT_TEMPLATE_VIEW3D
  );
}
