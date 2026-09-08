import { useSelector } from "react-redux";

import {
  selectModuleLabelsByKey,
  selectModuleIconKeysByKey,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

import { getModuleIconComponent } from "Features/viewers/data/moduleIconsMap";

import theme from "Styles/theme";

import BUSINESS_OBJECT_TYPES from "../data/businessObjectTypesCatalog";
import { getBusinessObjectsModuleKey } from "../utils/businessObjectModuleKeys";
import resolveBusinessObjectsModuleLabel from "../utils/resolveBusinessObjectsModuleLabel";

// Left-band module entries of the business-objects types (useViewers
// catalog shape), one per registry entry. Label and icon resolve the
// per-scope scopeConfig overrides first (moduleLabelsByKey /
// moduleIconKeysByKey, keyed by module key), then the type defaults.
export default function useBusinessObjectsModules() {
  // data

  // Relies on the V3 map editor (the legacy branch renders V2).
  const legacy = useSelector((s) => s.appConfig.enableMapEditorLegacy);
  const moduleLabelsByKey = useSelector(selectModuleLabelsByKey);
  const moduleIconKeysByKey = useSelector(selectModuleIconKeysByKey);
  const appConfigLabel = useSelector(
    (s) => s.appConfig.value?.strings?.modules?.businessObjects
  );

  // main

  return BUSINESS_OBJECT_TYPES.map((type) => {
    const key = getBusinessObjectsModuleKey(type.key);
    const label = resolveBusinessObjectsModuleLabel({
      typeKey: type.key,
      moduleLabelsByKey,
      appConfigLabel,
    });
    const Icon = getModuleIconComponent(
      moduleIconKeysByKey[key],
      type.defaultIconKey
    );
    return {
      key,
      label,
      shortLabel: label,
      icon: <Icon />,
      bgcolor: theme.palette.viewers.businessObjects,
      hotkey: type.hotkey,
      editors: type.editors,
      disabled: legacy,
    };
  });
}
