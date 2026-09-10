import { useSelector } from "react-redux";

import { PINNED_TOP_TOOL_KEYS } from "Features/rightPanel/utils/sortToolsByOrder";

import useScopeConfigActions from "../hooks/useScopeConfigActions";
import { selectDisabledToolKeys } from "../utils/scopeConfigSelectors";

import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";

import ListSortableSwitchConfig from "./ListSortableSwitchConfig";

// "Outils" section of the Modules & outils page: the tools of the right band
// (already in the scope order — useRightPanelTools applies
// scopeConfigs.toolOrder to its catalog) as one list. The switch toggles the
// ROOT activation (per-module activation stays on the module pages), the
// handle persists the per-scope order of the band. Locked tools (Propriétés,
// Réglages) never toggle; the tools the band anchors itself — "Propriétés"
// at the top, the `group: "bottom"` ones at the bottom — are not draggable.
export default function SectionToolsConfig({ tools, onOpenSettings }) {
  // strings

  const titleS = "Outils";
  const helperS = "Bandeau de droite.";

  // data

  const disabledToolKeys = useSelector(selectDisabledToolKeys);
  const { toggleToolRoot, setToolOrder } = useScopeConfigActions();

  // helpers

  const items = tools.map((t) => {
    let pin;
    if (PINNED_TOP_TOOL_KEYS.includes(t.key)) pin = "top";
    else if (t.group === "bottom") pin = "bottom";
    return {
      key: t.key,
      icon: t.icon,
      label: t.label,
      pin,
      pinTooltip:
        pin === "top"
          ? "Toujours en haut du bandeau"
          : "Toujours en bas du bandeau",
      checked: t.locked || !disabledToolKeys.includes(t.key),
      switchDisabled: t.locked,
      switchTooltip: t.locked ? "Toujours actif" : undefined,
    };
  });

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box>
          <WhiteSectionTitle>{titleS}</WhiteSectionTitle>
          <Typography variant="caption" color="text.secondary">
            {helperS}
          </Typography>
        </Box>

        <ListSortableSwitchConfig
          items={items}
          onToggle={toggleToolRoot}
          onOpenSettings={onOpenSettings}
          onOrderChange={setToolOrder}
        />
      </Box>
    </WhiteSectionGeneric>
  );
}
