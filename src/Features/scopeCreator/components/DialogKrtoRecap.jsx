import { useEffect, useState } from "react";

import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  MenuItem,
  Select,
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
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDataImageUrl from "Features/appConfig/hooks/useDataImageUrl";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import SectionKrtoPreview from "./SectionKrtoPreview";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import hatchedIllustrationSx from "../utils/hatchedIllustrationSx";
import getPageLabel from "../utils/getPageLabel";
import resolveBaseMapPages, {
  matchExistingListing,
} from "../utils/resolveBaseMapPages";

/*
 * Recap modal of the Krto about to be created. Left column: the form (name +
 * the configuration tags as read-only chips), the baseMap listings (dossiers
 * created — removable — and the project's — toggled with an eye), the
 * configuration pages to create — each with a target dossier select — the
 * optional modules and the create button. Right: the annotation templates
 * panel and the configuration's illustration (loaded lazily).
 */
export default function DialogKrtoRecap({
  open,
  onClose,
  configuration,
  projectId,
  nameField,
  options,
  onOptionsChange,
  extraBaseMapListings,
  onExtraBaseMapListingsChange,
  excludedLibraryKeys,
  onExcludedLibraryKeysChange,
  removedPageKeys,
  onRemovedPageKeysChange,
  removedListingNames,
  onRemovedListingNamesChange,
  baseMapPageTargets,
  onBaseMapPageTargetsChange,
  extraAnnotationListings,
  onExtraAnnotationListingsChange,
  extraLibraryKeys,
  onExtraLibraryKeysChange,
  hiddenExistingListingIds,
  onHiddenExistingListingIdsChange,
  onCreate,
  isCreating,
  canCreate,
}) {
  // state — "Nouvelle liste" dialog (deferred mode)

  const [createListingOpen, setCreateListingOpen] = useState(false);

  // strings

  const overlineS = "Configuration initiale";
  const changeConfigS = "Changer de configuration";
  const modulesS = "Modules";
  const dpgfS = "DPGF";
  const dpgfCaptionS =
    "Active le module Ouvrages avec une première liste « DPGF ».";
  const carnetDetailS = "Carnet de détail";
  const carnetDetailCaptionS =
    "Folios de détails liés aux repères — active le module Carnet de plans et l'outil Ressources.";
  const portfolioS = "Carnet de plans";
  const portfolioCaptionS =
    "Active le module Carnet de plans (portfolio de pages).";
  const baseMapsS = "Fonds de plan";
  const addS = "+ Ajouter";
  const createdSectionS = "Dossiers créés";
  const projectSectionS = "Dossiers du projet";
  const pagesSectionS = "Fonds de plan à créer";
  const noFolderS = "Aucun dossier";
  const newListingPlaceholderS = "Nom du dossier";
  const createS = "Créer le Krto";
  const hotkeyTooltipS = "Appuyez sur C pour créer";
  const noProjectS = "Sélectionnez d'abord un projet dans le tableau de bord.";

  // data

  const appConfig = useAppConfig();
  const existingBaseMapListings = useProjectBaseMapListings({ projectId });

  // the configuration's illustration — resolved only once the recap is open
  const { url: recapImageUrl, loading: recapImageLoading } = useDataImageUrl({
    orgaCode: appConfig?.orgaCode,
    relativePath: configuration?.recapImagePath,
    enabled: open,
  });

  // helpers — title

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";
  const titleS = configuration?.name ?? `${scopeS} générique`;

  // helpers — configuration tags (ouvrage + usage keyword families)

  const tags = [
    ...new Set([
      ...(configuration?.keywords?.ouvrage ?? []),
      ...(configuration?.keywords?.type ?? []),
    ]),
  ];

  // modules togglable at creation — the ones the configuration declares
  // optional (generic scope: both)
  const optionalModules = configuration
    ? (configuration.optionalModules ?? [])
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
  // by the configuration (removable by name) or added by the user.

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
    return matchExistingListing(listingConfig, existingListings);
  }

  const _removedListingNames = removedListingNames ?? [];

  const newListingRows = configListingRows.filter(
    (listingConfig) =>
      !findExistingListing(listingConfig) &&
      !_removedListingNames.includes(listingConfig.name)
  );

  const extraListings = extraBaseMapListings ?? [];

  // visibility eyes init — the configuration's disableExistingListings flag
  // hides the existing listings it does not reuse; the user then toggles.
  // Reads the unfiltered configListingRows on purpose (removed dossiers are
  // unmatched by construction, so they never count as reused).
  useEffect(() => {
    if (!open) return;
    if (hiddenExistingListingIds != null) return;
    const reusedIds = existingListings
      .filter((l) =>
        configListingRows.find((c) => findExistingListing(c) === l)
      )
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

  // pages (configuration baseMap items) to create and the dossiers they can
  // land in — shared resolution with useCreateScopeFromPreset
  const { folders, pages } = resolveBaseMapPages({
    listingConfigs: configListingRows,
    existingListings,
    removedListingNames: _removedListingNames,
    removedPageKeys,
    extraBaseMapListings: extraListings,
    hiddenExistingListingIds,
    pageTargets: baseMapPageTargets,
  });
  const folderOptions = [
    ...folders.filter((f) => f.kind === "new"),
    ...folders.filter((f) => f.kind === "existing"),
  ];

  // handlers

  function handleToggleListingVisibility(listingId) {
    const current = hiddenExistingListingIds ?? [];
    const next = current.includes(listingId)
      ? current.filter((id) => id !== listingId)
      : [...current, listingId];
    onHiddenExistingListingIdsChange(next);
  }

  function handleRemoveNewListing(name) {
    onRemovedListingNamesChange([..._removedListingNames, name]);
  }

  function handleRemovePage(pageKey) {
    onRemovedPageKeysChange([...(removedPageKeys ?? []), pageKey]);
  }

  function handlePageTargetChange(pageKey, targetKey) {
    onBaseMapPageTargetsChange({
      ...(baseMapPageTargets ?? {}),
      [pageKey]: targetKey,
    });
  }

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

  function renderSubSectionTitle(label, { mt = 0 } = {}) {
    return (
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt,
          mb: 0.5,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </Typography>
    );
  }

  // a page to create: name + format, the target dossier select, removable
  function renderPageRow(page) {
    return (
      <Box
        key={page.pageKey}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          py: 0.25,
        }}
      >
        <InsertDriveFileOutlinedIcon
          sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }}
        />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {page.name}
          </Typography>
          <Typography
            variant="caption"
            noWrap
            sx={{ display: "block", color: "text.secondary" }}
          >
            {getPageLabel(page)}
          </Typography>
        </Box>
        <Select
          size="small"
          variant="standard"
          disableUnderline
          displayEmpty
          value={page.targetKey ?? ""}
          onChange={(e) => handlePageTargetChange(page.pageKey, e.target.value)}
          disabled={folderOptions.length === 0}
          renderValue={(value) => {
            const folder = folderOptions.find((f) => f.targetKey === value);
            return (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  minWidth: 0,
                }}
              >
                <FolderOutlinedIcon
                  sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }}
                />
                <Typography variant="body2" noWrap sx={{ fontSize: 13 }}>
                  {folder?.name ?? noFolderS}
                </Typography>
              </Box>
            );
          }}
          sx={{ minWidth: 120, maxWidth: 150, fontSize: 13, flexShrink: 0 }}
        >
          {folderOptions.map((folder) => (
            <MenuItem
              key={folder.targetKey}
              value={folder.targetKey}
              dense
              sx={{ gap: 0.75 }}
            >
              <FolderOutlinedIcon
                sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }}
              />
              <Typography variant="body2" noWrap>
                {folder.name}
              </Typography>
            </MenuItem>
          ))}
        </Select>
        <IconButton
          size="small"
          onClick={() => handleRemovePage(page.pageKey)}
          sx={{ color: "text.secondary", p: 0.25 }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
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

  const sectionCardSx = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 2,
    bgcolor: "background.paper",
    p: 1.5,
  };

  const hasCreatedRows = newListingRows.length > 0 || extraListings.length > 0;

  // "Fonds de plan" section — dossiers created for the Krto (removable),
  // the project's dossiers (visibility eye), then the pages to create with
  // their target dossier.
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

      <Box sx={sectionCardSx}>
        {hasCreatedRows && renderSubSectionTitle(createdSectionS)}
        {newListingRows.map((row) => (
          <Box
            key={row.name}
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
            <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
              {row.name}
            </Typography>
            <IconButton
              size="small"
              onClick={() => handleRemoveNewListing(row.name)}
              sx={{ color: "text.secondary", p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
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

        {existingListings.length > 0 &&
          renderSubSectionTitle(projectSectionS, {
            mt: hasCreatedRows ? 1 : 0,
          })}
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

        {pages.length > 0 &&
          renderSubSectionTitle(pagesSectionS, {
            mt: hasCreatedRows || existingListings.length > 0 ? 1 : 0,
          })}
        {pages.map((page) => renderPageRow(page))}
      </Box>
    </Box>
  );

  // "Modules" card
  const modulesSectionNode =
    optionalModules.length > 0 ? (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {modulesS}
        </Typography>
        <Box sx={sectionCardSx}>
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
          {optionalModules.includes("PORTFOLIO") &&
            renderModuleRow({
              key: "portfolio",
              label: portfolioS,
              caption: portfolioCaptionS,
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
              gap: 2,
            }}
          >
            <WhiteSectionGeneric>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  p: 1,
                }}
              >
                {nameField}

                {tags.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "text.secondary",
                          bgcolor: (theme) =>
                            alpha(theme.palette.text.primary, 0.06),
                          border: "1px solid",
                          borderColor: "divider",
                          "& .MuiChip-label": { px: 0.9 },
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </WhiteSectionGeneric>

            {baseMapsSectionNode}

            {modulesSectionNode}
          </Box>

          {/* create band — pinned under the scrolling column */}
          <Box
            sx={{
              flexShrink: 0,
              px: 2.5,
              pb: 2.5,
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

        {/* right — templates panel + configuration illustration */}
        <SectionKrtoPreview
          libraries={libraries}
          onRemoveLibrary={(key) =>
            onExcludedLibraryKeysChange([...(excludedLibraryKeys ?? []), key])
          }
          extraAnnotationListings={extraAnnotationListings}
          onExtraAnnotationListingsChange={onExtraAnnotationListingsChange}
          onAddListingClick={() => setCreateListingOpen(true)}
          imageUrl={recapImageUrl}
          imageLoading={recapImageLoading}
          imageAlt={titleS}
          code={configuration?.code ?? null}
        />

        {/* "Nouvelle liste" — the app's add-listing dialog in deferred mode:
            choices land in the pre-creation state instead of the db. */}
        {createListingOpen && (
          <DialogCreateListing
            open={createListingOpen}
            onClose={() => setCreateListingOpen(false)}
            onCreateEmpty={(listingName, { avatarString } = {}) =>
              onExtraAnnotationListingsChange([
                ...(extraAnnotationListings ?? []),
                { name: listingName, ...(avatarString && { avatarString }) },
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
