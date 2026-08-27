// Initial field values for the creation form: auto-fill from the
// useDataMapping token declared as `mappedTo` on each manifest field.
export default function getTitleBlockPrefillValues(manifest, dataMapping) {
  const values = {};
  for (const field of manifest?.fields || []) {
    if (field.mappedTo && dataMapping?.[field.mappedTo]) {
      values[field.key] = dataMapping[field.mappedTo];
    }
  }
  return values;
}
