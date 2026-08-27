// Resolve the editable field values of a title block for a given portfolio.
// Precedence per field: metadata.titleBlock.values[key] -> metadata[legacyKey]
// (pre-titleBlock portfolios) -> "". `mappedTo` auto-fill is a creation-form
// prefill concern only, never applied silently at render time.
export default function resolveTitleBlockFields(manifest, metadata) {
  const stored = metadata?.titleBlock?.values || {};
  const values = {};
  for (const field of manifest?.fields || []) {
    values[field.key] =
      stored[field.key] ??
      (field.legacyKey ? metadata?.[field.legacyKey] : undefined) ??
      "";
  }
  return values;
}
