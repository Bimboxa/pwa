import { useSelector } from "react-redux";

import { LOCKED_MODULE_KEYS } from "Features/viewers/hooks/useViewers";
import { PINNED_TOP_MODULE_KEYS } from "Features/viewers/utils/sortModulesByOrder";

import useScopeConfigActions from "../hooks/useScopeConfigActions";
import { selectDisabledModuleKeys } from "../utils/scopeConfigSelectors";

import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";

import ListSortableSwitchConfig from "./ListSortableSwitchConfig";

// "Modules" section of the Modules & outils page: the modules of the left
// band (locked and disabled ones included, already in the scope order —
// useViewers applies scopeConfigs.moduleOrder on every path) as one list.
// The switch toggles the per-scope activation, the handle persists the
// per-scope order of the band. Locked modules (Fonds de plan, Dessin) never
// toggle; the pinned SCOPE module is not draggable.
export default function SectionModulesConfig({ modules, onOpenSettings }) {
  // strings

  const titleS = "Modules";
  const helperS = "Bandeau de gauche.";

  // data

  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  const { toggleModule, setModuleOrder } = useScopeConfigActions();

  // helpers

  const items = modules.map((m) => {
    const locked = LOCKED_MODULE_KEYS.has(m.key);
    return {
      key: m.key,
      icon: m.icon,
      label: m.label,
      pin: PINNED_TOP_MODULE_KEYS.includes(m.key) ? "top" : undefined,
      pinTooltip: "Toujours en haut du bandeau",
      checked: locked || !disabledModuleKeys.includes(m.key),
      switchDisabled: locked,
      switchTooltip: locked ? "Toujours actif" : undefined,
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
          onToggle={toggleModule}
          onOpenSettings={onOpenSettings}
          onOrderChange={setModuleOrder}
        />
      </Box>
    </WhiteSectionGeneric>
  );
}
