import { useSelector } from "react-redux";

import useScopeConfigActions from "../hooks/useScopeConfigActions";
import {
  selectDisabledModuleKeys,
  selectDisabledToolKeys,
  selectDisabledToolKeysByModule,
} from "../utils/scopeConfigSelectors";

import { Box, Divider, Typography } from "@mui/material";

import RowSwitchConfig from "./RowSwitchConfig";

// Tool page of the Configuration dialog: root activation (a root-disabled
// tool is gone in every module, whatever its per-module state), plus a
// read-only availability status per module — per-module editing stays on
// the module pages.
export default function PageToolConfig({ tool, modules }) {
  // data

  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  const disabledToolKeys = useSelector(selectDisabledToolKeys);
  const disabledToolKeysByModule = useSelector(selectDisabledToolKeysByModule);

  const { toggleToolRoot } = useScopeConfigActions();

  // helpers

  const rootDisabled = disabledToolKeys.includes(tool.key);
  const toolModules = modules.filter(
    (m) => !tool.viewers || tool.viewers.includes(m.key)
  );

  function getModuleStatus(moduleKey) {
    if (disabledModuleKeys.includes(moduleKey)) return "Module désactivé";
    if (rootDisabled) return "Désactivé globalement";
    if ((disabledToolKeysByModule[moduleKey] ?? []).includes(tool.key))
      return "Désactivé dans ce module";
    return "Actif";
  }

  // render

  return (
    <Box sx={{ px: 3, py: 2, maxWidth: 560 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Box sx={{ display: "flex", color: "text.secondary" }}>{tool.icon}</Box>
        <Typography variant="h6">{tool.label}</Typography>
      </Box>

      {tool.locked ? (
        <RowSwitchConfig
          label="Outil actif"
          caption="Toujours actif"
          checked
          disabled
        />
      ) : (
        <RowSwitchConfig
          label="Outil actif"
          caption="Désactivé, l'outil disparaît dans tous les modules."
          checked={!rootDisabled}
          onChange={() => toggleToolRoot(tool.key)}
        />
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Disponible dans les modules :
      </Typography>

      {toolModules.map((m) => (
        <Box
          key={m.key}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 0.5,
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ display: "flex", color: "text.secondary" }}>
              {m.icon}
            </Box>
            <Typography variant="body2">{m.label}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {getModuleStatus(m.key)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
