import { useSelector } from "react-redux";

import { LOCKED_MODULE_KEYS } from "Features/viewers/hooks/useViewers";

import useScopeConfigActions from "../hooks/useScopeConfigActions";
import {
  selectDisabledModuleKeys,
  selectDisabledToolKeys,
  selectDisabledToolKeysByModule,
} from "../utils/scopeConfigSelectors";

import { Box, Divider, Typography } from "@mui/material";

import RowSwitchConfig from "./RowSwitchConfig";

// Module page of the Configuration dialog: activation of the module itself
// (a disabled module leaves the left band, its Ctrl+letter unbinds), then
// the per-module activation of the tools available in that module.
export default function PageModuleConfig({ module, tools }) {
  // data

  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  const disabledToolKeys = useSelector(selectDisabledToolKeys);
  const disabledToolKeysByModule = useSelector(selectDisabledToolKeysByModule);

  const { toggleModule, toggleToolInModule } = useScopeConfigActions();

  // helpers

  const locked = LOCKED_MODULE_KEYS.has(module.key);
  const enabled = locked || !disabledModuleKeys.includes(module.key);

  const moduleTools = tools.filter(
    (t) => !t.viewers || t.viewers.includes(module.key)
  );
  const disabledForModule = disabledToolKeysByModule[module.key] ?? [];

  // render

  return (
    <Box sx={{ px: 3, py: 2, maxWidth: 560 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Box sx={{ display: "flex", color: "text.secondary" }}>
          {module.icon}
        </Box>
        <Typography variant="h6">{module.label}</Typography>
      </Box>

      <RowSwitchConfig
        label="Module actif"
        caption={
          locked
            ? "Toujours actif"
            : "Désactivé, le module disparaît du bandeau de gauche."
        }
        checked={enabled}
        disabled={locked}
        onChange={() => toggleModule(module.key)}
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Outils du module
      </Typography>

      {moduleTools.map((t) => {
        const rootDisabled = disabledToolKeys.includes(t.key);
        if (t.locked) {
          return (
            <RowSwitchConfig
              key={t.key}
              icon={t.icon}
              label={t.label}
              caption="Toujours actif"
              checked
              disabled
            />
          );
        }
        if (rootDisabled) {
          return (
            <RowSwitchConfig
              key={t.key}
              icon={t.icon}
              label={t.label}
              caption="Désactivé globalement (section Outils)"
              checked={false}
              disabled
            />
          );
        }
        return (
          <RowSwitchConfig
            key={t.key}
            icon={t.icon}
            label={t.label}
            checked={!disabledForModule.includes(t.key)}
            onChange={() => toggleToolInModule(module.key, t.key)}
          />
        );
      })}
    </Box>
  );
}
