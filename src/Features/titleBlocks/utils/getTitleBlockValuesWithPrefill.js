import getTitleBlockPrefillValues from "./getTitleBlockPrefillValues";

// Field values of a title block carried by a record's `metadata` (e.g. the
// scope behind the capture tool cartouche), with live defaults: a field
// whose key EXISTS in `metadata.titleBlock.values` keeps its stored value
// (an emptied field stays empty), every other field falls back to the
// useDataMapping token declared as `mappedTo` on the manifest field
// (chantier, auteur, date...), then "". Unlike resolveTitleBlockFields no
// legacy metadata keys are read — the record never had a pre-titleBlock
// cartouche.
export default function getTitleBlockValuesWithPrefill(
  manifest,
  metadata,
  dataMapping
) {
  const stored = metadata?.titleBlock?.values || {};
  const prefill = getTitleBlockPrefillValues(manifest, dataMapping);
  const values = {};
  for (const field of manifest?.fields || []) {
    values[field.key] =
      field.key in stored
        ? (stored[field.key] ?? "")
        : (prefill[field.key] ?? "");
  }
  return values;
}
