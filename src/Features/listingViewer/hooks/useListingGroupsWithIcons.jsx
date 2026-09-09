import { useMemo } from "react";

import useBusinessObjectsModules from "Features/businessObjects/hooks/useBusinessObjectsModules";

import { getBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

import {
  Layers,
  Pentagon,
  PhotoCamera,
  AccountTree,
  MenuBook,
  Print,
  Style,
  Category,
} from "@mui/icons-material";

// Icon of a listing group, by entityModel type. Mirrors the left band so the
// same family reads the same in both places. BUSINESS_OBJECT is absent on
// purpose: its groups take the icon of their business object type, resolved
// below with the per-scope overrides.
const ICON_BY_TYPE = {
  BASE_MAP: <Layers />,
  LOCATED_ENTITY: <Pentagon />,
  ANNOTATION_TEMPLATE: <Style />,
  PHOTO: <PhotoCamera />,
  ZONING: <AccountTree />,
  ZONE_ENTITY: <AccountTree />,
  PORTFOLIO_PAGE: <MenuBook />,
  BLUEPRINT: <Print />,
  LEGEND_ENTITY: <Category />,
};

// Decorates the groups of getListingGroupsByEntityModelType with the icon —
// and, for the business-object families, the label — they display in the
// panel. Business object types resolve through the left-band module entries,
// so a scope that renamed or re-iconed a module sees the same wording here.
export default function useListingGroupsWithIcons(groups) {
  const businessObjectsModules = useBusinessObjectsModules();

  return useMemo(() => {
    const moduleByKey = {};
    businessObjectsModules.forEach((m) => {
      moduleByKey[m.key] = m;
    });

    return (groups ?? []).map((group) => {
      if (group.businessObjectTypeKey) {
        const module =
          moduleByKey[getBusinessObjectsModuleKey(group.businessObjectTypeKey)];
        return {
          ...group,
          label: module?.label ?? group.label,
          icon: module?.icon ?? null,
        };
      }
      return { ...group, icon: ICON_BY_TYPE[group.type] ?? null };
    });
  }, [groups, businessObjectsModules]);
}
