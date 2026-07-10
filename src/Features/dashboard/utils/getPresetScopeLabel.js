export default function getPresetScopeLabel(appConfig, presetScopeKey) {
  if (!presetScopeKey) return null;

  const items = appConfig?.features?.presetScopes?.items;
  const item = items?.find((i) => i.key === presetScopeKey);
  if (item?.label) return item.label;

  const presetScopesObject = appConfig?.presetScopesObject;
  const preset = presetScopesObject?.[presetScopeKey];
  if (preset?.name) return preset.name;

  return presetScopeKey;
}
