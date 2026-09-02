import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setShowLayers } from "Features/popperMapListings/popperMapListingsSlice";

import { LOCKED_MODULE_KEYS } from "Features/viewers/hooks/useViewers";

import useScopeConfigActions from "../hooks/useScopeConfigActions";
import {
  selectDisabledModuleKeys,
  selectDisabledToolKeys,
  selectDisabledToolKeysByModule,
  selectModuleLabelsByKey,
} from "../utils/scopeConfigSelectors";

import { Box, Divider, TextField, Typography } from "@mui/material";

import RowSwitchConfig from "./RowSwitchConfig";

// Modules whose label is configurable per scope (stored in
// scopeConfigs.moduleLabelsByKey). Generic mechanism, exposed for the
// Ouvrages module only in v1.
const RENAMABLE_MODULE_KEYS = new Set(["BUSINESS_OBJECTS"]);

// Module page of the Configuration dialog: activation of the module itself
// (a disabled module leaves the left band, its Ctrl+letter unbinds), then
// the per-module activation of the tools available in that module.
export default function PageModuleConfig({ module, tools }) {
  const dispatch = useDispatch();

  // data

  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  // Dessin-only setting (moved from the popper's properties panel). Session
  // state: auto-enabled when the baseMap has layers (PopperMapListings).
  const showLayers = useSelector((s) => s.popperMapListings.showLayers);
  const disabledToolKeys = useSelector(selectDisabledToolKeys);
  const disabledToolKeysByModule = useSelector(selectDisabledToolKeysByModule);
  const moduleLabelsByKey = useSelector(selectModuleLabelsByKey);

  const { toggleModule, toggleToolInModule, setModuleLabel } =
    useScopeConfigActions();

  // state — module label override edited locally, committed on blur

  const labelOverride = moduleLabelsByKey[module.key] ?? "";
  const [labelDraft, setLabelDraft] = useState(labelOverride);

  useEffect(() => {
    setLabelDraft(labelOverride);
  }, [module.key, labelOverride]);

  // helpers

  const locked = LOCKED_MODULE_KEYS.has(module.key);
  const enabled = locked || !disabledModuleKeys.includes(module.key);
  const renamable = RENAMABLE_MODULE_KEYS.has(module.key);

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

      {renamable && (
        <>
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Nom du module
          </Typography>

          <TextField
            fullWidth
            size="small"
            label="Nom affiché"
            placeholder={module.label}
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={() => {
              if (labelDraft.trim() !== labelOverride)
                setModuleLabel(module.key, labelDraft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
            helperText="Nom du module pour ce dossier (bandeau de gauche, panneaux). Vide : nom par défaut."
          />
        </>
      )}

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

      {module.key === "MAP" && (
        <>
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Calques
          </Typography>

          <RowSwitchConfig
            label="Travailler avec des calques"
            caption="Activé automatiquement quand le fond de plan contient des calques."
            checked={showLayers}
            onChange={() => dispatch(setShowLayers(!showLayers))}
          />
        </>
      )}
    </Box>
  );
}
