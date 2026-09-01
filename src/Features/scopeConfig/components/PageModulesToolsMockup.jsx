import { useSelector } from "react-redux";

import useScopeConfigActions from "../hooks/useScopeConfigActions";
import {
  selectDisabledModuleKeys,
  selectDisabledToolKeys,
} from "../utils/scopeConfigSelectors";

import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";

// "Généralités > Modules & outils" page: a mockup of the main screen — the
// left modules band and the right tools band rendered as on the real layout.
// Clicking a module toggles its per-scope activation; clicking a tool toggles
// its ROOT activation (per-module activation stays on the module pages).
export default function PageModulesToolsMockup({ modules, tools }) {
  // data

  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  const disabledToolKeys = useSelector(selectDisabledToolKeys);

  const { toggleModule, toggleToolRoot } = useScopeConfigActions();

  // helpers

  const enabledCount = modules.filter(
    (m) => !disabledModuleKeys.includes(m.key)
  ).length;

  const topTools = tools.filter((t) => t.group !== "bottom");
  const bottomTools = tools.filter((t) => t.group === "bottom");

  // handlers

  function handleModuleClick(moduleKey) {
    const enabled = !disabledModuleKeys.includes(moduleKey);
    // At least one module must stay enabled — UI-level guard.
    if (enabled && enabledCount <= 1) return;
    toggleModule(moduleKey);
  }

  function handleToolClick(tool) {
    if (tool.locked) return;
    toggleToolRoot(tool.key);
  }

  // render - one module button of the left band mockup

  function renderModule(m) {
    const enabled = !disabledModuleKeys.includes(m.key);
    const isLastEnabled = enabled && enabledCount <= 1;
    const tooltip = isLastEnabled
      ? "Au moins un module doit rester actif."
      : enabled
        ? "Cliquer pour désactiver"
        : "Cliquer pour activer";
    return (
      <Tooltip key={m.key} title={tooltip} placement="right">
        <ButtonBase
          onClick={() => handleModuleClick(m.key)}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
            py: 1.5,
            px: 0.5,
            color: "common.white",
            opacity: enabled ? 0.9 : 0.25,
            transition: "all 0.15s ease",
            "&:hover": { opacity: enabled ? 1 : 0.45 },
          }}
        >
          <Box sx={{ fontSize: 24, display: "flex", alignItems: "center" }}>
            {m.icon}
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: "common.white",
              fontSize: "0.65rem",
              lineHeight: 1.2,
              textAlign: "center",
              maxWidth: 80,
            }}
          >
            {m.shortLabel}
          </Typography>
          {m.hotkey && (
            <Typography
              variant="caption"
              sx={{
                color: "common.white",
                fontSize: "0.6rem",
                lineHeight: 1,
                px: 0.5,
                py: 0.25,
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: 0.5,
                opacity: 0.8,
                whiteSpace: "nowrap",
              }}
            >
              {`Ctrl + ${m.hotkey}`}
            </Typography>
          )}
        </ButtonBase>
      </Tooltip>
    );
  }

  // render - one tool button of the right band mockup

  function renderTool(t) {
    const rootDisabled = disabledToolKeys.includes(t.key);
    const tooltip = t.locked
      ? "Toujours actif"
      : rootDisabled
        ? "Cliquer pour activer"
        : "Cliquer pour désactiver";
    return (
      <Tooltip key={t.key} title={tooltip} placement="left">
        <ButtonBase
          onClick={() => handleToolClick(t)}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 70,
            minHeight: 65,
            p: "8px 4px",
            borderRadius: 1,
            color: "text.secondary",
            opacity: rootDisabled ? 0.3 : 1,
            cursor: t.locked ? "default" : "pointer",
            transition: "all 0.15s ease",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {t.icon}
          <Typography
            variant="caption"
            sx={{ mt: "4px", lineHeight: 1.2, textAlign: "center" }}
          >
            {t.label}
          </Typography>
          {t.hotkey && (
            <Typography
              variant="caption"
              sx={{
                mt: "2px",
                fontSize: "0.6rem",
                lineHeight: 1,
                px: 0.5,
                py: 0.25,
                color: "text.secondary",
                border: (theme) => `1px solid ${theme.palette.divider}`,
                borderRadius: 0.5,
              }}
            >
              {t.hotkey}
            </Typography>
          )}
        </ButtonBase>
      </Tooltip>
    );
  }

  // render

  return (
    <Box
      sx={{
        px: 3,
        py: 2,
        height: 1,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Modules & outils
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {"Cliquez sur un module ou un outil pour l'activer ou le désactiver."}
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexGrow: 1,
          minHeight: 320,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        {/* left band mockup — modules */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            bgcolor: "common.black",
            py: 1,
            width: 90,
            minWidth: 90,
            overflowY: "auto",
          }}
        >
          {modules.map(renderModule)}
        </Box>

        {/* central work area placeholder */}
        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
          }}
        >
          <Typography variant="body2" color="text.disabled">
            Zone de travail
          </Typography>
        </Box>

        {/* right band mockup — tools */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            p: 1,
            borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: "background.default",
            overflowY: "auto",
          }}
        >
          {topTools.map(renderTool)}
          {bottomTools.length > 0 && (
            <Box
              sx={{
                mt: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              {bottomTools.map(renderTool)}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
