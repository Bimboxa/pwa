import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import usePresetScopes from "../hooks/usePresetScopes";
import useKrtoConfigurations from "../hooks/useKrtoConfigurations";
import useCreateScopeFromPreset from "../hooks/useCreateScopeFromPreset";

import MenuKrtoConfigurationsFilter from "./MenuKrtoConfigurationsFilter";
import SectionSelectKrtoConfiguration from "./SectionSelectKrtoConfiguration";
import DialogKrtoRecap from "./DialogKrtoRecap";

import getDefaultScopeName from "../utils/getDefaultScopeName";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";
import { PAGE_BG, AMBER_GLOW } from "Features/dashboard/utils/dashboardStyles";

import db from "App/db/db";

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

  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : null),
    [projectId]
  );

  const { createScopeFromPreset, isCreating } = useCreateScopeFromPreset({
    projectId,
  });

  // strings

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";
  const title = appConfig?.strings?.scope?.new ?? `Nouveau ${scopeS.toLowerCase()}`;
  const pageTitleS = "Partir d'une configuration";
  const pageSubtitleS = `Chaque configuration pré-remplit le ${scopeS} — vous ajusterez ensuite`;
  const searchPlaceholderS = "Rechercher une configuration";
  const genericButtonS = `${scopeS} vierge`;
  const configLabelS = "Configuration de départ";
  const genericLabelS = `${scopeS} générique`;
  const genericHelperS = "Structure vide, à construire librement";
  const nameLabelS = `Nom du ${scopeS}`;
  const nameHelperS = "Pré-rempli d'après la configuration.";
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
  const [recapOpen, setRecapOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  // combined nav filters — one keyword per family (usage AND ouvrage)
  const [activeFilter, setActiveFilter] = useState({
    type: null,
    ouvrage: null,
  });
  // main ouvrage/type categories (selects in the recap modal) — prefilled
  // from the selected configuration, saved into scope.metaData.categories.
  const [categories, setCategories] = useState({ ouvrage: null, type: null });
  // creation options — dpgf: BUSINESS_OBJECTS module + first "DPGF" listing;
  // carnetDetail: PORTFOLIO module + DIVERS annotation library.
  const [options, setOptions] = useState({ dpgf: false, carnetDetail: false });
  // extra baseMap listings added via "+ Ajouter" in the recap modal.
  const [extraBaseMapListings, setExtraBaseMapListings] = useState([]);
  // recap-modal adjustments: removed libraries / removed pages
  // (keys "listingName::itemName"), added empty annotation listings
  // ("+ Nouvelle liste") and added blank pages ("+ Fond de plan").
  const [excludedLibraryKeys, setExcludedLibraryKeys] = useState([]);
  const [removedPageKeys, setRemovedPageKeys] = useState([]);
  const [extraAnnotationListings, setExtraAnnotationListings] = useState([]);
  const [extraBaseMapPages, setExtraBaseMapPages] = useState([]);
  // preset libraries added via the "Nouvelle liste" dialog
  const [extraLibraryKeys, setExtraLibraryKeys] = useState([]);
  // visibility eyes of the existing baseMap listings (per-scope
  // baseMapsSettings.disabledListingIds) — null until the recap initializes
  // it from the configuration.
  const [hiddenExistingListingIds, setHiddenExistingListingIds] =
    useState(null);

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
    const optionKeywords = configuration?.keywords?.options ?? [];
    // only the modules declared optional by the configuration are togglable —
    // and only those get prechecked (generic scope: both available).
    const optionalModules = configuration
      ? configuration.optionalModules ?? []
      : ["DPGF", "CARNET_DETAIL"];
    setCategories({
      ouvrage: configuration?.keywords?.ouvrage?.[0] ?? null,
      type: configuration?.keywords?.type?.[0] ?? null,
    });
    setOptions({
      dpgf:
        optionalModules.includes("DPGF") && optionKeywords.includes("DPGF"),
      carnetDetail:
        optionalModules.includes("CARNET_DETAIL") &&
        optionKeywords.includes("Carnet de détail"),
    });
    setExtraBaseMapListings([]);
    setExcludedLibraryKeys([]);
    setRemovedPageKeys([]);
    setExtraAnnotationListings([]);
    setExtraBaseMapPages([]);
    setExtraLibraryKeys([]);
    setHiddenExistingListingIds(null);
    setRecapOpen(true);
  }

  function handleNameChange(e) {
    const value = e.target.value;
    setName(value);
    // clearing the field re-arms the config-driven prefill
    setNameEdited(value !== "");
  }

  async function handleCreate() {
    if (isCreating || !name.trim() || !projectId) return;
    // usage/ouvrage categories are required in the configuration flow
    if (krtoConfigurations && (!categories.type || !categories.ouvrage))
      return;
    const key = selectedKey === GENERIC_KEY ? null : selectedKey;
    try {
      await createScopeFromPreset({
        name: name.trim(),
        presetScopeKey: krtoConfigurations ? null : key,
        configurationKey: krtoConfigurations ? key : null,
        options,
        extraBaseMapListings,
        extraAnnotationListings,
        extraBaseMapPages,
        extraLibraryKeys,
        excludedLibraryKeys,
        removedBaseMapItemKeys: removedPageKeys,
        hiddenExistingListingIds,
        metaData:
          krtoConfigurations && (categories.ouvrage || categories.type)
            ? { categories: { ...categories } }
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

  // hotkey — C triggers the creation (recap modal only). Ref keeps a single
  // stable window listener while handleCreate changes every render.
  const handleCreateRef = useRef(handleCreate);
  handleCreateRef.current = handleCreate;

  const hotkeyEnabled = Boolean(open && krtoConfigurations && recapOpen);
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
      required={Boolean(krtoConfigurations)}
      sx={{ mt: 1 }}
    />
  );

  // full-page variant — dashboard-styled selector page (left nav + card
  // grid); clicking a card opens the recap modal (DialogKrtoRecap) where the
  // Krto is finalized and created.
  if (krtoConfigurations) {
    const selectedConfiguration =
      selectedKey === GENERIC_KEY
        ? null
        : krtoConfigurations.items?.find((c) => c.key === selectedKey);

    const subtitleS = project?.name
      ? `${pageSubtitleS} · ${project.name}`
      : pageSubtitleS;

    return (
      <Dialog
        fullScreen
        open={open}
        onClose={handleClose}
        PaperProps={{ sx: { bgcolor: PAGE_BG } }}
      >
        <Box
          sx={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            height: 1,
            overflow: "hidden",
          }}
        >
          {/* warm gradient band + orange glows — same recipe as the dashboard */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 340,
              pointerEvents: "none",
              background: (theme) =>
                `linear-gradient(180deg, ${alpha(
                  theme.palette.secondary.main,
                  0.1
                )} 0%, ${alpha(
                  theme.palette.secondary.main,
                  0.03
                )} 70%, ${alpha(theme.palette.secondary.main, 0)} 100%)`,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              top: -120,
              right: -80,
              width: 520,
              height: 520,
              borderRadius: "50%",
              pointerEvents: "none",
              background: (theme) =>
                `radial-gradient(circle, ${alpha(
                  theme.palette.secondary.main,
                  0.14
                )} 0%, ${alpha(theme.palette.secondary.main, 0)} 70%)`,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              top: -60,
              left: "22%",
              width: 380,
              height: 380,
              borderRadius: "50%",
              pointerEvents: "none",
              background: `radial-gradient(circle, ${alpha(
                AMBER_GLOW,
                0.12
              )} 0%, ${alpha(AMBER_GLOW, 0)} 70%)`,
            }}
          />

          {/* header */}
          <Box
            sx={{
              position: "relative",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 2,
              px: 4,
              pt: 3,
              pb: 2,
            }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {pageTitleS}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {subtitleS}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <TextField
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={searchPlaceholderS}
                size="small"
                sx={{
                  width: 300,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 99,
                    bgcolor: "background.paper",
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="outlined"
                onClick={() => handleConfigurationSelect(null)}
                sx={{
                  borderRadius: 99,
                  bgcolor: "background.paper",
                  whiteSpace: "nowrap",
                }}
              >
                {genericButtonS}
              </Button>
              <IconButton
                onClick={handleClose}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* body — left nav + card grid */}
          <Box
            sx={{
              position: "relative",
              display: "flex",
              flexGrow: 1,
              minHeight: 0,
              px: 4,
              pb: 3,
              gap: 3,
            }}
          >
            <MenuKrtoConfigurationsFilter
              items={krtoConfigurations.items}
              activeFilter={activeFilter}
              onChange={setActiveFilter}
            />
            <Box sx={{ flexGrow: 1, overflow: "auto", pr: 1 }}>
              <SectionSelectKrtoConfiguration
                selectedKey={selectedKey === GENERIC_KEY ? null : selectedKey}
                onSelect={handleConfigurationSelect}
                searchText={searchText}
                activeFilter={activeFilter}
              />
            </Box>
          </Box>

          <DialogKrtoRecap
            open={recapOpen}
            onClose={() => setRecapOpen(false)}
            configuration={selectedConfiguration}
            projectId={projectId}
            nameField={nameField}
            categories={categories}
            onCategoriesChange={setCategories}
            options={options}
            onOptionsChange={setOptions}
            extraBaseMapListings={extraBaseMapListings}
            onExtraBaseMapListingsChange={setExtraBaseMapListings}
            excludedLibraryKeys={excludedLibraryKeys}
            onExcludedLibraryKeysChange={setExcludedLibraryKeys}
            removedPageKeys={removedPageKeys}
            onRemovedPageKeysChange={setRemovedPageKeys}
            extraAnnotationListings={extraAnnotationListings}
            onExtraAnnotationListingsChange={setExtraAnnotationListings}
            extraLibraryKeys={extraLibraryKeys}
            onExtraLibraryKeysChange={setExtraLibraryKeys}
            hiddenExistingListingIds={hiddenExistingListingIds}
            onHiddenExistingListingIdsChange={setHiddenExistingListingIds}
            extraBaseMapPages={extraBaseMapPages}
            onExtraBaseMapPagesChange={setExtraBaseMapPages}
            onCreate={handleCreate}
            isCreating={isCreating}
            canCreate={
              Boolean(name.trim()) &&
              Boolean(projectId) &&
              Boolean(categories.type) &&
              Boolean(categories.ouvrage)
            }
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
