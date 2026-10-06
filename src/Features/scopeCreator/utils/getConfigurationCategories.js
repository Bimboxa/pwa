// scope.metaData.categories — every tag of the configuration, per keyword
// family (arrays). null when the configuration declares no keywords (generic
// / empty scope).
export default function getConfigurationCategories(configuration) {
  const keywords = configuration?.keywords;
  if (!keywords) return null;
  return {
    ouvrage: [...(keywords.ouvrage ?? [])],
    type: [...(keywords.type ?? [])],
    options: [...(keywords.options ?? [])],
  };
}
