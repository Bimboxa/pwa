import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import getZeroPaddingNumber from "Features/misc/utils/getZeroPaddingNumber";

// Label of a helper row: the annotation's own label, else « Modèle 03 »
// numbered in the template's draw order like the Dessin panel.
// → { byId: Map<id, annotation>, getLabel(annotation) }
export default function createAnnotationLabeler(annotations, templateById) {
  const byId = new Map();
  const byTemplateId = new Map();
  for (const a of annotations ?? []) {
    byId.set(a.id, a);
    if (!a.annotationTemplateId) continue;
    const list = byTemplateId.get(a.annotationTemplateId);
    if (list) list.push(a);
    else byTemplateId.set(a.annotationTemplateId, [a]);
  }
  const rankById = new Map();
  for (const list of byTemplateId.values()) {
    list
      .slice()
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
      .forEach((a, idx) => rankById.set(a.id, idx + 1));
  }

  function getLabel(annotation) {
    const template = templateById?.[annotation.annotationTemplateId];
    return (
      getAnnotationOwnLabel(annotation) ||
      `${template?.label ?? annotation.type} ${getZeroPaddingNumber(
        rankById.get(annotation.id) ?? 0,
        2
      )}`
    );
  }

  return { byId, getLabel };
}
