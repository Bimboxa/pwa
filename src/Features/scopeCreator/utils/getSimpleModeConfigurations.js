/*
 * Configurations offered by the compact creation dialog (device preference
 * "Gestion des configurations" off). `source` is any {items, simpleModeKeys}
 * object — features.krtoConfigurations, or {items: presetScopes,
 * simpleModeKeys: features.scopeCreator.simpleMode.presetScopeKeys} for the
 * legacy preset scopes. `simpleModeKeys` restricts and orders the items;
 * absent => every item, registry order.
 */
// Configuration kinds that need the recap dialog (the Prompt IA flow has its
// description / zip / result steps there): never offered in the compact one.
const RECAP_ONLY_KINDS = ["PROMPT_IA"];

export default function getSimpleModeConfigurations(source) {
  const items = (source?.items ?? []).filter(
    (item) => !RECAP_ONLY_KINDS.includes(item.kind)
  );
  const keys = source?.simpleModeKeys;
  if (!Array.isArray(keys)) return items;
  return keys
    .map((key) => items.find((item) => item.key === key))
    .filter(Boolean);
}
