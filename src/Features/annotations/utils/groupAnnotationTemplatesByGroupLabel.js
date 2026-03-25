// Inserts { isGroupHeader: true, groupLabel } objects before each group
// of consecutive templates sharing the same non-empty groupLabel.
// Inserts { isGroupDivider: true } when an ungrouped item follows a group.
// Uses normalized matching (uppercase, no spaces) to compare group names.
// Does NOT re-sort — respects the incoming order.

function normalizeGroupLabel(g) {
  return (g ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export default function groupAnnotationTemplatesByGroupLabel(templates) {
  if (!templates?.length) return templates ?? [];

  const result = [];
  let currentNormalized = null;

  for (const template of templates) {
    if (template?.isDivider) {
      result.push(template);
      continue;
    }

    const raw = template?.groupLabel?.trim() || "";
    const normalized = normalizeGroupLabel(raw);

    if (normalized && normalized !== currentNormalized) {
      currentNormalized = normalized;
      result.push({ isGroupHeader: true, groupLabel: raw });
    } else if (!normalized && currentNormalized) {
      // Leaving a group — insert a divider
      currentNormalized = null;
      result.push({ isGroupDivider: true });
    }

    result.push(template);
  }

  return result;
}
