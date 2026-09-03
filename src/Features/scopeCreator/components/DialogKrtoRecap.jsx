import { useEffect, useState } from "react";

import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  CircularProgress,
  Dialog,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useKrtoConfigurations from "../hooks/useKrtoConfigurations";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import SectionKrtoPreview from "./SectionKrtoPreview";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import hatchedIllustrationSx from "../utils/hatchedIllustrationSx";

/*
 * Recap modal of the Krto about to be created. Left: the form (name,
 * ouvrage/type, modules, plan listings). Right: a preview mirroring the
 * app's layout (templates panel left, plan right).
 */
export default function DialogKrtoRecap({
  open,
  onClose,
  configuration,
  projectId,
  nameField,
  categories,
  onCategoriesChange,
  options,
  onOptionsChange,
  extraBaseMapListings,
  onExtraBaseMapListingsChange,
  excludedLibraryKeys,
  onExcludedLibraryKeysChange,
  removedPageKeys,
  onRemovedPageKeysChange,
  extraAnnotationListings,
  onExtraAnnotationListingsChange,
  extraLibraryKeys,
  onExtraLibraryKeysChange,
  hiddenExistingListingIds,
  onHiddenExistingListingIdsChange,
  extraBaseMapPages,
  onExtraBaseMapPagesChange,
  onCreate,
  isCreating,
  canCreate,
}) {
  // state — "Nouvelle liste" dialog (deferred mode)

  const [createListingOpen, setCreateListingOpen] = useState(false);
  // strings

  const overlineS = "Configuration initiale";
  const changeConfigS = "Changer de configuration";
  const ouvrageS = "Ouvrage";
  const usageS = "Usage";
  const otherS = "Autre";
  const modulesS = "Modules";
  const dpgfS = "DPGF";
  const dpgfCaptionS = "Active le module Ouvrages avec une première liste « DPGF ».";
  const carnetDetailS = "Carnet de détail";
  const carnetDetailCaptionS =
    "Folios de détails liés aux repères — active le module Carnet de plans et l'outil Ressources.";
  const baseMapsS = "Fonds de plan";
  const addS = "+ Ajouter";
  const existingSectionS = "Dossiers existants";
  const newSectionS = "Nouveaux dossiers";
  const newListingPlaceholderS = "Nom du dossier";
  const createS = "Créer le Krto";
  const hotkeyTooltipS = "Appuyez sur C pour créer";
  const noProjectS = "Sélectionnez d'abord un projet dans le tableau de bord.";

  // data

  const appConfig = useAppConfig();
  const krtoConfigurations = useKrtoConfigurations();
  const existingBaseMapListings = useProjectBaseMapListings({ projectId });

  // helpers — title

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";
  const titleS = configuration?.name ?? `${scopeS} générique`;

  // helpers — ouvrage/type options (union across configurations)

  function getCategoryOptions(familyKey) {
    const values = [];
    for (const item of krtoConfigurations?.items ?? []) {
      for (const keyword of item.keywords?.[familyKey] ?? []) {
        if (!values.includes(keyword)) values.push(keyword);
      }
    }
    return values;
  }
  const ouvrageOptions = getCategoryOptions("ouvrage");
  const typeOptions = getCategoryOptions("type");

  // modules togglable at creation — the ones the configuration declares
  // optional (generic scope: both)
  const optionalModules = configuration
    ? configuration.optionalModules ?? []
    : ["DPGF", "CARNET_DETAIL"];

  // helpers — annotation libraries (+ DIVERS via the Carnet de détail option)

  const libraryKeys = [
    ...(configuration?.annotations?.libraryKeys ?? []),
    ...(options?.carnetDetail ? ["DIVERS"] : []),
    ...(extraLibraryKeys ?? []),
  ];
  const libraries = [...new Set(libraryKeys)]
    .filter((key) => !(excludedLibraryKeys ?? []).includes(key))
    .map((key) => {
      const presetListing = appConfig?.presetListingsObject?.[key];
      return {
        key,
        name: presetListing?.name ?? key,
        templates: presetListing?.annotationTemplatesLibrary ?? [],
      };
    });
  // helpers — baseMap listings: existing project listings (visibility eyes,
  // per-scope baseMapsSettings.disabledListingIds) vs new listings declared
  // by the configuration or added by the user.

  const existingListings = existingBaseMapListings ?? [];

  const configListingRows = configuration?.baseMaps?.listings?.length
    ? configuration.baseMaps.listings
    : !configuration && existingListings.length === 0
      ? [
          { name: "Vues en plan", items: [] },
          { name: "Coupes & élévations", verticalBaseMaps: true, items: [] },
        ]
      : [];

  function findExistingListing(listingConfig) {
    return existingListings.find(
      (l) =>
        l.name === listingConfig.name &&
        Boolean(l.verticalBaseMaps) === Boolean(listingConfig.verticalBaseMaps)
    );
  }

  const newListingRows = configListingRows.filter(
    (listingConfig) => !findExistingListing(listingConfig)
  );

  const extraListings = extraBaseMapListings ?? [];

  // visibility eyes init — the configuration's disableExistingListings flag
  // hides the existing listings it does not reuse; the user then toggles.
  useEffect(() => {
    if (!open) return;
    if (hiddenExistingListingIds != null) return;
    const reusedIds = existingListings
      .filter((l) => configListingRows.find((c) => findExistingListing(c) === l))
      .map((l) => l.id);
    const initial = configuration?.baseMaps?.disableExistingListings
      ? existingListings
          .filter((l) => !reusedIds.includes(l.id))
          .map((l) => l.id)
      : [];
    onHiddenExistingListingIdsChange(initial);
  }, [
    open,
    hiddenExistingListingIds,
    configuration?.key,
    existingListings.length,
  ]);

  function handleToggleListingVisibility(listingId) {
    const current = hiddenExistingListingIds ?? [];
    const next = current.includes(listingId)
      ? current.filter((id) => id !== listingId)
      : [...current, listingId];
    onHiddenExistingListingIdsChange(next);
  }

  // pages shown in the preview — the new baseMap items, tagged with their
  // destination listing (dossier) and keyed for removal; minus the removed
  // ones.
  const newPages = configListingRows
    .flatMap((listingConfig) =>
      (listingConfig.items ?? []).map((item) => ({
        ...item,
        listingName: listingConfig.name,
        pageKey: `${listingConfig.name}::${item.name}`,
      }))
    )
    .filter((page) => !(removedPageKeys ?? []).includes(page.pageKey));

  // default destination for "+ Fond de plan" pages
  const defaultPageListingName =
    configListingRows[0]?.name ??
    extraListings.find((l) => l.name?.trim())?.name?.trim() ??
    existingListings[0]?.name ??
    "Vues en plan";

  // handlers

  function handleAddListing() {
    onExtraBaseMapListingsChange([...extraListings, { name: "" }]);
  }

  function handleExtraListingNameChange(index, value) {
    const next = extraListings.map((l, i) =>
      i === index ? { ...l, name: value } : l
    );
    onExtraBaseMapListingsChange(next);
  }

  function handleRemoveExtraListing(index) {
    onExtraBaseMapListingsChange(extraListings.filter((l, i) => i !== index));
  }

  // render

  // one column per category family — single-select rows, click again to clear
  function renderCategoryColumn({ familyKey, label, valueOptions }) {
    const selected = categories?.[familyKey] ?? null;
    return (
      <Box
        sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.25 }}
      >
        <Typography
          variant="overline"
          sx={{ color: "text.secondary", px: 1, letterSpacing: "0.15em" }}
        >
          {label} *
        </Typography>
        {valueOptions.map((option) => {
          const active = selected === option;
          return (
            <ButtonBase
              key={option}
              onClick={() =>
                onCategoriesChange({
                  ...categories,
                  [familyKey]: active ? null : option,
                })
              }
              sx={{
                justifyContent: "flex-start",
                px: 1,
                py: 0.5,
                borderRadius: 1.5,
                textAlign: "left",
                ...(active && {
                  bgcolor: (theme) =>
                    alpha(theme.palette.secondary.main, 0.08),
                }),
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: active ? 600 : 400,
                  color: active ? "secondary.main" : "text.primary",
                }}
              >
                {option}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    );
  }

  function renderModuleRow({ key, label, caption }) {
    const checked = Boolean(options?.[key]);
    return (
      <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Checkbox
          size="small"
          color="secondary"
          checked={checked}
          onChange={() => onOptionsChange({ ...options, [key]: !checked })}
          sx={{ p: 0.5 }}
        />
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {label}
        </Typography>
        <Tooltip title={caption}>
          <IconButton size="small" sx={{ color: "text.secondary" }}>
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // "Fonds de plan" section — rendered at the top of the preview panel,
  // just above "Modèles d'annotations", with the same header + white-card
  // styling. Rows: folder icon left, name, visibility eye at the end.
  const baseMapsSectionNode = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {baseMapsS}
        </Typography>
        <Button
          size="small"
          color="secondary"
          onClick={handleAddListing}
          sx={{ minWidth: 0 }}
        >
          {addS}
        </Button>
      </Box>

      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
          p: 1.5,
        }}
      >
        {existingListings.length > 0 && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 0.5,
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {existingSectionS}
          </Typography>
        )}
        {existingListings.map((listing) => {
          const hidden = (hiddenExistingListingIds ?? []).includes(listing.id);
          return (
            <Box
              key={listing.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                py: 0.25,
              }}
            >
              <FolderOutlinedIcon
                sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }}
              />
              <Typography
                variant="body2"
                noWrap
                sx={{
                  flexGrow: 1,
                  color: hidden ? "text.disabled" : "text.primary",
                }}
              >
                {listing.name}
              </Typography>
              <IconButton
                size="small"
                onClick={() => handleToggleListingVisibility(listing.id)}
                sx={{
                  p: 0.25,
                  color: hidden ? "text.disabled" : "secondary.main",
                }}
              >
                {hidden ? (
                  <VisibilityOffOutlinedIcon sx={{ fontSize: 16 }} />
                ) : (
                  <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Box>
          );
        })}

        {(newListingRows.length > 0 || extraListings.length > 0) && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: existingListings.length > 0 ? 1 : 0,
              mb: 0.5,
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {newSectionS}
          </Typography>
        )}
        {newListingRows.map((row) => (
          <Box
            key={row.name}
            sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.25 }}
          >
            <FolderOutlinedIcon
              sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }}
            />
            <Typography variant="body2" noWrap>
              {row.name}
            </Typography>
          </Box>
        ))}
        {extraListings.map((listing, index) => (
          <Box
            key={index}
            sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}
          >
            <FolderOutlinedIcon
              sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }}
            />
            <TextField
              value={listing.name}
              onChange={(e) =>
                handleExtraListingNameChange(index, e.target.value)
              }
              placeholder={newListingPlaceholderS}
              size="small"
              fullWidth
            />
            <IconButton
              size="small"
              onClick={() => handleRemoveExtraListing(index)}
              sx={{ color: "text.secondary", p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );

  // "Modules" card — rendered in the preview panel, below the annotation
  // template listings.
  const modulesSectionNode =
    optionalModules.length > 0 ? (
      <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {modulesS}
        </Typography>
        <Box
          sx={{
            p: 1.5,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          {optionalModules.includes("DPGF") &&
            renderModuleRow({
              key: "dpgf",
              label: dpgfS,
              caption: dpgfCaptionS,
            })}
          {optionalModules.includes("CARNET_DETAIL") &&
            renderModuleRow({
              key: "carnetDetail",
              label: carnetDetailS,
              caption: carnetDetailCaptionS,
            })}
        </Box>
      </Box>
    ) : null;

  return (
    <Dialog
      open={open}
      onClose={isCreating ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, height: "85vh" } }}
    >
      {/* header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 3,
          py: 2,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            flexShrink: 0,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...(!configuration?.imageUrl && hatchedIllustrationSx),
          }}
        >
          {configuration?.imageUrl && (
            <Box
              component="img"
              src={configuration.imageUrl}
              alt={titleS}
              sx={{ width: 1, height: 1, objectFit: "contain" }}
            />
          )}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{ color: "text.secondary", lineHeight: 1.5 }}
          >
            {overlineS}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }} noWrap>
            {titleS}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={isCreating}
          sx={{ borderRadius: 99, whiteSpace: "nowrap" }}
        >
          {changeConfigS}
        </Button>
      </Box>

      {/* body */}
      <Box
        sx={{
          display: "flex",
          flexGrow: 1,
          minHeight: 0,
          ...(isCreating && { pointerEvents: "none", opacity: 0.6 }),
        }}
      >
        {/* left — form on a "background" surface, with the create band */}
        <Box
          sx={{
            width: 400,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            bgcolor: "background.default",
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              flexGrow: 1,
              overflow: "auto",
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            <WhiteSectionGeneric>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2.5,
                  p: 1,
                }}
              >
                {nameField}

                <Box
                  sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}
                >
                  {renderCategoryColumn({
                    familyKey: "type",
                    label: usageS,
                    valueOptions: [...new Set([...typeOptions, otherS])],
                  })}
                  {renderCategoryColumn({
                    familyKey: "ouvrage",
                    label: ouvrageS,
                    valueOptions: [...new Set([...ouvrageOptions, otherS])],
                  })}
                </Box>
              </Box>
            </WhiteSectionGeneric>

            {/* create band — under the white card, same width */}
            <Box
              sx={{
                width: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 1.5,
              }}
            >
            {!canCreate && !isCreating && !projectId && (
              <Typography variant="caption" sx={{ color: "warning.main" }}>
                {noProjectS}
              </Typography>
            )}
            <Tooltip title={hotkeyTooltipS}>
              <span style={{ display: "flex" }}>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={onCreate}
                  disabled={isCreating || !canCreate}
                  sx={{ borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}
                  startIcon={
                    isCreating ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : null
                  }
                >
                  {createS}
                  {/* in-button hotkey chip, same style as ButtonSaveScope's Ctrl+S */}
                  {!isCreating && (
                    <Typography
                      variant="caption"
                      sx={{
                        ml: 1,
                        fontSize: "0.6rem",
                        lineHeight: 1,
                        px: 0.5,
                        py: 0.25,
                        border: "1px solid currentColor",
                        borderRadius: 0.5,
                        opacity: 0.7,
                        whiteSpace: "nowrap",
                      }}
                    >
                      C
                    </Typography>
                  )}
                </Button>
              </span>
            </Tooltip>
            </Box>
          </Box>
        </Box>

        {/* right — app-mirroring preview */}
        <SectionKrtoPreview
          panelTopContent={baseMapsSectionNode}
          panelBottomContent={modulesSectionNode}
          libraries={libraries}
          onRemoveLibrary={(key) =>
            onExcludedLibraryKeysChange([
              ...(excludedLibraryKeys ?? []),
              key,
            ])
          }
          pages={newPages}
          onRemovePage={(pageKey) =>
            onRemovedPageKeysChange([...(removedPageKeys ?? []), pageKey])
          }
          extraAnnotationListings={extraAnnotationListings}
          onExtraAnnotationListingsChange={onExtraAnnotationListingsChange}
          onAddListingClick={() => setCreateListingOpen(true)}
          extraPages={extraBaseMapPages}
          onExtraPagesChange={onExtraBaseMapPagesChange}
          defaultPageListingName={defaultPageListingName}
        />

        {/* "Nouvelle liste" — the app's add-listing dialog in deferred mode:
            choices land in the pre-creation state instead of the db. */}
        {createListingOpen && (
          <DialogCreateListing
            open={createListingOpen}
            onClose={() => setCreateListingOpen(false)}
            onCreateEmpty={(listingName) =>
              onExtraAnnotationListingsChange([
                ...(extraAnnotationListings ?? []),
                { name: listingName },
              ])
            }
            onAddPresets={(presetKeys) =>
              onExtraLibraryKeysChange([
                ...new Set([...(extraLibraryKeys ?? []), ...presetKeys]),
              ])
            }
          />
        )}
      </Box>
    </Dialog>
  );
}
