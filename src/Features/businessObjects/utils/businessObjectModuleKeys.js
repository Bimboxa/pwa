import BUSINESS_OBJECT_TYPES, {
  DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
} from "../data/businessObjectTypesCatalog";

// Module key <-> business object type key. STANDARD keeps the historical
// literal key: persisted scopeConfigs rows, localStorage, yaml
// defaultEnabledModuleKeys and Krto configurations all reference
// "BUSINESS_OBJECTS". Other types get a suffixed key.
//
// Pure module (no hooks, no slices): safe to import from selectors, slices
// and init services.

const BASE_KEY = "BUSINESS_OBJECTS";
const PREFIX = `${BASE_KEY}_`;

export function getBusinessObjectsModuleKey(
  typeKey = DEFAULT_BUSINESS_OBJECT_TYPE_KEY
) {
  return typeKey === DEFAULT_BUSINESS_OBJECT_TYPE_KEY
    ? BASE_KEY
    : `${PREFIX}${typeKey}`;
}

// Type key of a business-objects module key, null when the key is not a
// business-objects module of a REGISTERED type (a stale key restored from
// localStorage or found in a scopeConfigs row degrades to "unknown module").
export function getBusinessObjectTypeKeyFromModuleKey(moduleKey) {
  if (moduleKey === BASE_KEY) return DEFAULT_BUSINESS_OBJECT_TYPE_KEY;
  if (typeof moduleKey !== "string" || !moduleKey.startsWith(PREFIX))
    return null;
  const typeKey = moduleKey.slice(PREFIX.length);
  return BUSINESS_OBJECT_TYPES.some((t) => t.key === typeKey) ? typeKey : null;
}

export function isBusinessObjectsModuleKey(moduleKey) {
  return getBusinessObjectTypeKeyFromModuleKey(moduleKey) !== null;
}

// Module keys of every registered type, catalog order.
export const BUSINESS_OBJECTS_MODULE_KEYS = BUSINESS_OBJECT_TYPES.map((t) =>
  getBusinessObjectsModuleKey(t.key)
);
