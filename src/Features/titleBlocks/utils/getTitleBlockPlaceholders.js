// Form input placeholders: the live default shown while a field has no
// stored value, from the useDataMapping token declared as
// `placeholderMappedTo` on the manifest field (nothing is persisted —
// rendering falls back through the cell's fallbackBind).
export default function getTitleBlockPlaceholders(manifest, dataMapping) {
  const placeholders = {};
  for (const field of manifest?.fields || []) {
    if (field.placeholderMappedTo && dataMapping?.[field.placeholderMappedTo]) {
      placeholders[field.key] = dataMapping[field.placeholderMappedTo];
    }
  }
  return placeholders;
}
