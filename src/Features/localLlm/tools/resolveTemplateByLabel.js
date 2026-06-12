// Resolves an annotation template from its label (case/space insensitive),
// falling back to an id match. When several templates share the same label
// (one per listing), the one of `preferredListingId` wins.

export default function resolveTemplateByLabel(
  templates,
  labelOrId,
  { preferredListingId } = {}
) {
  if (!labelOrId || !templates?.length) return null;

  const byId = templates.find((t) => t.id === labelOrId);
  if (byId) return byId;

  const normalize = (s) => (s ?? "").trim().toLowerCase();
  const target = normalize(labelOrId);
  const matches = templates.filter((t) => normalize(t.label) === target);
  if (matches.length === 0) return null;

  return matches.find((t) => t.listingId === preferredListingId) ?? matches[0];
}
