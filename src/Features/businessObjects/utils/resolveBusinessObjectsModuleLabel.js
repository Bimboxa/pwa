import {
  DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
  getBusinessObjectType,
} from "../data/businessObjectTypesCatalog";
import { getBusinessObjectsModuleKey } from "./businessObjectModuleKeys";

// Label of a business-objects module. Priority: per-scope override
// (scopeConfig.moduleLabelsByKey, keyed by module key) > org appConfig
// strings.modules.businessObjects (names the STANDARD type only) > the
// type's default label.
export default function resolveBusinessObjectsModuleLabel({
  typeKey = DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
  moduleLabelsByKey,
  appConfigLabel,
} = {}) {
  const override = moduleLabelsByKey?.[getBusinessObjectsModuleKey(typeKey)];
  if (override?.trim()) return override.trim();
  if (typeKey === DEFAULT_BUSINESS_OBJECT_TYPE_KEY && appConfigLabel)
    return appConfigLabel;
  return getBusinessObjectType(typeKey)?.defaultLabel ?? "Ouvrages";
}
