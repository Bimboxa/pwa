import { useState } from "react";

import { useSelector } from "react-redux";

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
import useCreateScopeFromPreset from "../hooks/useCreateScopeFromPreset";

import getDefaultScopeName from "../utils/getDefaultScopeName";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

const GENERIC_KEY = "__GENERIC__";

export default function DialogCreateScopeFromPreset({
  open,
  onClose,
  projectId,
}) {
  // data

  const appConfig = useAppConfig();
  const presetScopes = usePresetScopes();
  const userProfile = useSelector((s) => s.auth.userProfile);

  const { createScopeFromPreset, isCreating } = useCreateScopeFromPreset({
    projectId,
  });

  // strings

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";
  const title = appConfig?.strings?.scope?.new ?? `Nouveau ${scopeS.toLowerCase()}`;
  const configLabelS = "Configuration de départ";
  const genericLabelS = `${scopeS} générique`;
  const genericHelperS = "Structure vide, à construire librement";
  const nameLabelS = `Nom du ${scopeS}`;
  const nameHelperS = "Pré-rempli avec la configuration choisie — modifiable.";
  const cancelS = "Annuler";
  const createS = "Créer";

  // helpers

  const trigram =
    userProfile?.trigram ?? getDebugAuthFromLocalStorage()?.trigram ?? null;

  function getPrefilledName(presetKey) {
    if (presetKey === GENERIC_KEY) return getDefaultScopeName({ trigram });
    return presetScopes?.find((ps) => ps.key === presetKey)?.name ?? "";
  }

  // state

  const [selectedKey, setSelectedKey] = useState(GENERIC_KEY);
  const [name, setName] = useState(() => getPrefilledName(GENERIC_KEY));
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
    if (isCreating || !name.trim()) return;
    await createScopeFromPreset({
      name: name.trim(),
      presetScopeKey: selectedKey === GENERIC_KEY ? null : selectedKey,
    });
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
            <MenuItem value={GENERIC_KEY}>{genericLabelS}</MenuItem>
            {presetScopes?.map((ps) => (
              <MenuItem key={ps.key} value={ps.key}>
                {ps.name}
              </MenuItem>
            ))}
          </Select>
          {selectedKey === GENERIC_KEY && (
            <FormHelperText>{genericHelperS}</FormHelperText>
          )}
        </FormControl>

        <TextField
          label={nameLabelS}
          value={name}
          onChange={handleNameChange}
          onKeyDown={handleNameKeyDown}
          helperText={nameHelperS}
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
          disabled={isCreating || !name.trim()}
        >
          {createS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
