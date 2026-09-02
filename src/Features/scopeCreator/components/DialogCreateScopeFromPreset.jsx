import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
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

import SectionSelectKrtoConfiguration from "./SectionSelectKrtoConfiguration";
import SectionKrtoSummary from "./SectionKrtoSummary";

import getDefaultScopeName from "../utils/getDefaultScopeName";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

const GENERIC_KEY = "__GENERIC__";

// Same guard as the 2D hotkeys: never steal keystrokes from a real field.
const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

export default function DialogCreateScopeFromPreset({
  open,
  onClose,
  projectId,
}) {
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
    if (krtoConfigurations) {
      return (
        krtoConfigurations.items?.find((c) => c.key === presetKey)?.name ?? ""
      );
    }
    return presetScopes?.find((ps) => ps.key === presetKey)?.name ?? "";
  }

  // state

  const [selectedKey, setSelectedKey] = useState(GENERIC_KEY);
  const [name, setName] = useState(() => getPrefilledName(GENERIC_KEY));
  const [nameEdited, setNameEdited] = useState(false);
  // main ouvrage/type categories (single-select chips, stored as 0-or-1-item
  // arrays for the chips component) — prefilled from the selected
  // configuration, saved as single values into scope.metaData.categories.
  const [categories, setCategories] = useState({ ouvrage: [], type: [] });
  // creation options — dpgf: enable the BUSINESS_OBJECTS module with a first
  // "DPGF" objects listing.
  const [options, setOptions] = useState({ dpgf: false });

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

  function handleConfigurationSelect(key) {
    const nextKey = key ?? GENERIC_KEY;
    setSelectedKey(nextKey);
    if (!nameEdited) setName(getPrefilledName(nextKey));
    const configuration = krtoConfigurations?.items?.find(
      (c) => c.key === key
    );
    setCategories({
      ouvrage: (configuration?.keywords?.ouvrage ?? []).slice(0, 1),
      type: (configuration?.keywords?.type ?? []).slice(0, 1),
    });
  }

  function handleNameChange(e) {
    const value = e.target.value;
    setName(value);
    // clearing the field re-arms the config-driven prefill
    setNameEdited(value !== "");
  }

  async function handleCreate() {
    if (isCreating || !name.trim() || !projectId) return;
    const key = selectedKey === GENERIC_KEY ? null : selectedKey;
    try {
      await createScopeFromPreset({
        name: name.trim(),
        presetScopeKey: krtoConfigurations ? null : key,
        configurationKey: krtoConfigurations ? key : null,
        options,
        metaData:
          krtoConfigurations &&
          (categories.ouvrage?.length || categories.type?.length)
            ? {
                categories: {
                  ouvrage: categories.ouvrage?.[0] ?? null,
                  type: categories.type?.[0] ?? null,
                },
              }
            : null,
      });
    } catch (error) {
      console.error("[DialogCreateScopeFromPreset] creation failed", error);
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

  // hotkey — C triggers the creation (full-page variant only). Ref keeps a
  // single stable window listener while handleCreate changes every render.
  const handleCreateRef = useRef(handleCreate);
  handleCreateRef.current = handleCreate;

  const hotkeyEnabled = Boolean(open && krtoConfigurations);
  useEffect(() => {
    if (!hotkeyEnabled) return;
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      if (e.key?.toLowerCase() !== "c") return;
      e.preventDefault();
      handleCreateRef.current();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [hotkeyEnabled]);

  // render

  const nameField = (
    <TextField
      label={nameLabelS}
      value={name}
      onChange={handleNameChange}
      onKeyDown={handleNameKeyDown}
      helperText={nameHelperS}
      size="small"
      fullWidth
      autoFocus
      sx={{ mt: 1 }}
    />
  );

  // full-page variant — left: configuration search (cards + filters), which
  // prefills the right summary panel (name on top, listings, libraries, and
  // the create button). Same fullScreen dialog pattern as DialogConfiguration.
  if (krtoConfigurations) {
    const selectedConfiguration =
      selectedKey === GENERIC_KEY
        ? null
        : krtoConfigurations.items?.find((c) => c.key === selectedKey);

    return (
      <Dialog fullScreen open={open} onClose={handleClose}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
            bgcolor: "background.default",
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="h6">{title}</Typography>
          <Button onClick={handleClose} disabled={isCreating}>
            {cancelS}
          </Button>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexGrow: 1,
            minHeight: 0,
            // freeze all interactions while the scope is being created
            ...(isCreating && { pointerEvents: "none", opacity: 0.6 }),
          }}
        >
          <Box sx={{ flexGrow: 1, overflow: "auto", p: 3 }}>
            <SectionSelectKrtoConfiguration
              selectedKey={selectedKey === GENERIC_KEY ? null : selectedKey}
              onSelect={handleConfigurationSelect}
            />
          </Box>

          <SectionKrtoSummary
            nameField={nameField}
            configuration={selectedConfiguration}
            projectId={projectId}
            categories={categories}
            onCategoriesChange={setCategories}
            options={options}
            onOptionsChange={setOptions}
            onCreate={handleCreate}
            isCreating={isCreating}
            canCreate={Boolean(name.trim()) && Boolean(projectId)}
          />
        </Box>
      </Dialog>
    );
  }

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
        {nameField}
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
