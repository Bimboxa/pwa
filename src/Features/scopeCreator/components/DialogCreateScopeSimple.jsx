import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import usePresetScopes from "../hooks/usePresetScopes";
import useKrtoConfigurations from "../hooks/useKrtoConfigurations";
import useCreateScopeFromPreset from "../hooks/useCreateScopeFromPreset";

import getDefaultScopeName from "../utils/getDefaultScopeName";
import getSimpleModeConfigurations from "../utils/getSimpleModeConfigurations";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

const EMPTY_KEY = "__EMPTY__";
const GENERIC_KEY = "__GENERIC__";

// Compact scope creation dialog — shown when the "Gestion des configurations"
// device preference is off: prefilled name + a "Configuration de départ"
// select. Entries: "vide" (default — EMPTY_SCOPE_CONFIGURATION: no annotation
// listing, one "Fonds de plan" listing, core modules only), "générique"
// (system listings + default baseMap listings, same as the card selector's
// "vierge" pill), then
// the org configurations (simpleModeKeys subset) or, for orgs without Krto
// configurations, the legacy preset scopes (presetScopeKeys subset).
// features.scopeCreator.simpleMode {showEmpty, showGeneric, presetScopeKeys}
// (yaml) hides the built-in entries / restricts the preset scopes.
export default function DialogCreateScopeSimple({ open, onClose, projectId }) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const presetScopes = usePresetScopes();
  const krtoConfigurations = useKrtoConfigurations();
  const userProfile = useSelector((s) => s.auth.userProfile);

  const { createScopeFromPreset, isCreating } = useCreateScopeFromPreset({
    projectId,
  });

  // strings

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "plan de repérage";
  const title = appConfig?.strings?.scope?.new ?? "Créer un plan de repérage";
  const emptyLabelS =
    appConfig?.strings?.scope?.newEmpty ?? "Plan de repérage vide";
  const genericLabelS = `${scopeS} générique`;
  const configLabelS = "Configuration de départ";
  const emptyHelperS =
    "Aucune liste d'annotations, modules Fonds de plan et Dessin uniquement";
  const genericHelperS = "Listes système et fonds de plan par défaut";
  const nameLabelS = `Nom du ${scopeS}`;
  const cancelS = "Annuler";
  const createS = "Créer";

  // helpers

  const trigram =
    userProfile?.trigram ?? getDebugAuthFromLocalStorage()?.trigram ?? null;

  const simpleMode = appConfig?.features?.scopeCreator?.simpleMode;
  const showEmpty = simpleMode?.showEmpty ?? true;
  const showGeneric = simpleMode?.showGeneric ?? true;

  const configurations = krtoConfigurations
    ? getSimpleModeConfigurations(krtoConfigurations)
    : getSimpleModeConfigurations({
        items: presetScopes ?? [],
        simpleModeKeys: simpleMode?.presetScopeKeys,
      });

  // first visible entry — "vide", else "générique", else first configuration
  const defaultKey = showEmpty
    ? EMPTY_KEY
    : showGeneric
      ? GENERIC_KEY
      : (configurations[0]?.key ?? EMPTY_KEY);

  function getPrefilledName(key) {
    if (key === EMPTY_KEY || key === GENERIC_KEY)
      return getDefaultScopeName({ trigram });
    return configurations.find((c) => c.key === key)?.name ?? "";
  }

  // state

  const [selectedKey, setSelectedKey] = useState(defaultKey);
  const [name, setName] = useState(() => getPrefilledName(defaultKey));
  const [nameEdited, setNameEdited] = useState(false);

  // handlers

  function handleClose() {
    if (isCreating) return;
    onClose();
  }

  function handleConfigChange(e) {
    const key = e.target.value;
    setSelectedKey(key);
    if (!nameEdited) setName(getPrefilledName(key));
  }

  function handleNameChange(e) {
    const value = e.target.value;
    setName(value);
    // clearing the field re-arms the config-driven prefill
    setNameEdited(value !== "");
  }

  async function handleCreate() {
    if (isCreating || !name.trim() || !projectId) return;
    try {
      if (selectedKey === EMPTY_KEY) {
        // bare scope (EMPTY_SCOPE_CONFIGURATION)
        await createScopeFromPreset({ name: name.trim(), empty: true });
      } else if (selectedKey === GENERIC_KEY) {
        // generic scope: system listings + default baseMap listings when the
        // project has none (configuration flow without configuration, or the
        // legacy null preset for orgs without Krto configurations).
        await createScopeFromPreset(
          krtoConfigurations
            ? {
                name: name.trim(),
                configurationKey: null,
                options: { dpgf: false, carnetDetail: false },
              }
            : { name: name.trim(), presetScopeKey: null }
        );
      } else if (krtoConfigurations) {
        const configuration = configurations.find((c) => c.key === selectedKey);
        // same derivation as the card selector: optional modules prechecked
        // when the configuration declares them, categories from its keywords.
        const optionKeywords = configuration?.keywords?.options ?? [];
        const optionalModules = configuration?.optionalModules ?? [];
        const categories = {
          ouvrage: configuration?.keywords?.ouvrage?.[0] ?? null,
          type: configuration?.keywords?.type?.[0] ?? null,
        };
        await createScopeFromPreset({
          name: name.trim(),
          configurationKey: selectedKey,
          options: {
            dpgf:
              optionalModules.includes("DPGF") &&
              optionKeywords.includes("DPGF"),
            carnetDetail:
              optionalModules.includes("CARNET_DETAIL") &&
              optionKeywords.includes("Carnet de détail"),
          },
          metaData:
            categories.ouvrage || categories.type ? { categories } : null,
        });
      } else {
        await createScopeFromPreset({
          name: name.trim(),
          presetScopeKey: selectedKey,
        });
      }
    } catch (error) {
      console.error("[DialogCreateScopeSimple] creation failed", error);
      dispatch(
        setToaster({
          message: "Erreur lors de la création — réessayez.",
          isError: true,
        })
      );
    }
  }

  function handleNameKeyDown(e) {
    if (e.key === "Enter") handleCreate();
  }

  // render

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
      >
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <InputLabel>{configLabelS}</InputLabel>
          <Select
            value={selectedKey}
            onChange={handleConfigChange}
            label={configLabelS}
            MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
          >
            {showEmpty && <MenuItem value={EMPTY_KEY}>{emptyLabelS}</MenuItem>}
            {showGeneric && (
              <MenuItem value={GENERIC_KEY}>{genericLabelS}</MenuItem>
            )}
            {configurations.map((c) => (
              <MenuItem key={c.key} value={c.key}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
          {selectedKey === EMPTY_KEY && (
            <FormHelperText>{emptyHelperS}</FormHelperText>
          )}
          {selectedKey === GENERIC_KEY && (
            <FormHelperText>{genericHelperS}</FormHelperText>
          )}
        </FormControl>

        <TextField
          label={nameLabelS}
          value={name}
          onChange={handleNameChange}
          onKeyDown={handleNameKeyDown}
          size="small"
          fullWidth
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isCreating}>
          {cancelS}
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={isCreating || !name.trim() || !projectId}
        >
          {createS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
