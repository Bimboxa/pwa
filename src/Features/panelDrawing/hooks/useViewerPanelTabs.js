import { useMemo } from "react";
import { useSelector } from "react-redux";

import useViewers from "Features/viewers/hooks/useViewers";
import useBusinessObjectListings from "Features/businessObjects/hooks/useBusinessObjectListings";

import { getBusinessObjectTypeKeyFromModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import getBusinessObjectTypeOfListing from "Features/businessObjects/utils/getBusinessObjectTypeOfListing";

export const VIEWER_PANEL_TAB_ANNOTATIONS = "ANNOTATIONS";
export const VIEWER_PANEL_TAB_BASE_MAPS = "BASE_MAPS";

// Tabs of the Viewer module's left panel: the annotations, the base maps
// (visibility toggles — replaces the removed floating chips band), then one
// tab per business object type whose module is enabled for the scope AND
// which has at least one listing. Labels and order are the left band's ones
// (useViewers). The stored tab falls back to the annotations when it left
// the list (scope change, module disabled, last listing deleted).
export default function useViewerPanelTabs() {
  // strings

  const annotationsS = "Annotations";
  const baseMapsS = "Fonds de plan";

  // data

  const modules = useViewers();
  const listings = useBusinessObjectListings();
  const storedKey = useSelector((s) => s.panelDrawing.viewerPanelTab);

  // helpers

  const typeKeysWithListings = useMemo(
    () =>
      new Set(
        (listings ?? []).map((l) => getBusinessObjectTypeOfListing(l).key)
      ),
    [listings]
  );

  const tabs = [
    { key: VIEWER_PANEL_TAB_ANNOTATIONS, label: annotationsS },
    { key: VIEWER_PANEL_TAB_BASE_MAPS, label: baseMapsS },
  ];
  modules.forEach((module) => {
    const typeKey = getBusinessObjectTypeKeyFromModuleKey(module.key);
    if (!typeKey || !typeKeysWithListings.has(typeKey)) return;
    tabs.push({ key: typeKey, label: module.label });
  });

  const activeKey = tabs.some((t) => t.key === storedKey)
    ? storedKey
    : VIEWER_PANEL_TAB_ANNOTATIONS;

  // result

  return { tabs, activeKey };
}
