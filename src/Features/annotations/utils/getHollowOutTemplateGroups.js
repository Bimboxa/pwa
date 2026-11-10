import {
  TEMPLATELESS_LABEL,
  TEMPLATELESS_TEMPLATE_ID,
  isTemplatelessAnnotation,
} from "./templatelessAnnotations";

// Group key of a cutting annotation: its template, or the template-less
// sentinel (same key as the solo / eye filters).
export const getHollowOutGroupKey = (annotation) =>
  annotation?.annotationTemplateId ?? TEMPLATELESS_TEMPLATE_ID;

// The cutting annotations of « Évider » grouped by annotation template, sorted
// by label: [{ key, label, iconSource, count }].
export default function getHollowOutTemplateGroups(
  candidates,
  annotationTemplates
) {
  const templateById = new Map(
    (annotationTemplates ?? []).map((t) => [t.id, t])
  );
  const groupByKey = new Map();
  for (const candidate of candidates ?? []) {
    const key = getHollowOutGroupKey(candidate);
    let group = groupByKey.get(key);
    if (!group) {
      const template = templateById.get(key);
      group = {
        key,
        label:
          template?.label ??
          (isTemplatelessAnnotation(candidate)
            ? TEMPLATELESS_LABEL
            : candidate.label || "-?"),
        iconSource: template ?? candidate,
        count: 0,
      };
      groupByKey.set(key, group);
    }
    group.count += 1;
  }
  return [...groupByKey.values()].sort((a, b) =>
    String(a.label).localeCompare(String(b.label))
  );
}
