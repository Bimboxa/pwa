// Display name of a base map: "(à nommer)" placeholder (rendered in italic
// by the callers) when the name is empty or whitespace-only.
export default function getBaseMapDisplayName(baseMap) {
  const name = baseMap?.name?.trim();
  return { label: name || "(à nommer)", isPlaceholder: !name };
}
