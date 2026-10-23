import {
  DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
  getBusinessObjectType,
} from "../data/businessObjectTypesCatalog";

// Type entry of a business object type with its strings resolved for the
// org: the catalog strings, overridden key by key by the org appConfig
// (strings.businessObjectTypes.<TYPE_KEY>, blank values ignored). Unknown /
// missing keys read as STANDARD. Only the strings are overridable: key,
// defaultLabel, features... stay those of the catalog.
export default function resolveBusinessObjectType({
  typeKey = DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
  appConfigStringsByType,
} = {}) {
  const type =
    getBusinessObjectType(typeKey) ??
    getBusinessObjectType(DEFAULT_BUSINESS_OBJECT_TYPE_KEY);
  const overrides = appConfigStringsByType?.[type.key];
  if (!overrides || typeof overrides !== "object") return type;

  const strings = { ...type.strings };
  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) strings[key] = value.trim();
  });
  return { ...type, strings };
}
