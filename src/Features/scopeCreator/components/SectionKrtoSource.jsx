import { useEffect, useMemo, useState } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSyncedVersionToStorage } from "Features/remoteScopeConfigurations/remoteScopeConfigurationsSlice";

import {
  Box,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  ListSubheader,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
} from "@mui/material";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingItemsCountById from "Features/listings/hooks/useListingItemsCountById";
import useSourceScopeCandidates from "../hooks/useSourceScopeCandidates";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import AvatarListing from "Features/listings/components/AvatarListing";

import downloadRemoteScopeService from "Features/remoteScopeConfigurations/services/downloadRemoteScopeService";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import {
  SOURCE_SCOPE_MODES,
  getSourceScopeListings,
} from "../services/applySourceScopeService";

const EMPTY_LISTINGS = [];

/*
 * « Krto source » section of the creation recap: the scope whose drawing
 * listings are brought into the new Krto.
 * - scope select: the project's scopes, installed or not (cloud icon); a
 *   scope not installed on this device is downloaded from a button, without
 *   being opened;
 * - listings of the source scope, ticked one by one (all by default);
 * - exclusive link (read-only) / copy options.
 *
 * `sourceScope` = { scopeId, mode, listingIds } — `listingIds: null` means
 * every listing. `onReadyChange(true)` once the source is installed with at
 * least one listing ticked (gates the creation when `required`).
 */
export default function SectionKrtoSource({
  open,
  projectId,
  sourceConfigurationKeys,
  required,
  disabled,
  sourceScope,
  onSourceScopeChange,
  onReadyChange,
  sectionCardSx,
}) {
  // strings

  const appConfig = useAppConfig();
  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";
  const sourceS = appConfig?.strings?.scope?.source ?? `${scopeS} source`;

  const noneS = "Aucun";
  const pickS = `Choisir un ${scopeS}`;
  const suggestedS = "Suggérés";
  const othersS = "Autres";
  const requiredS = "Obligatoire";
  const hintS = `Les listes de ce ${scopeS} sont ajoutées au nouveau ${scopeS}.`;
  const notInstalledS = `Ce ${scopeS} n'est pas installé sur cet appareil.`;
  const notInstalledTagS = "Non installé";
  const downloadS = "Télécharger";
  const downloadingS = "Téléchargement en cours…";
  const importingS = "Chargement des données…";
  const downloadErrorS = "Le téléchargement a échoué.";
  const listingsS = "Listes à récupérer";
  const noListingS = `Ce ${scopeS} ne contient aucune liste d'annotations.`;
  const annotationsCountS = (count) =>
    count === 1 ? "1 annotation" : `${count} annotations`;
  const linkS = "Annotations en lecture seule (recommandé)";
  const copyS = "Copier les annotations";
  const linkCaptionS = `Les listes du ${scopeS} source sont affichées ici sans être copiées : elles restent modifiables uniquement depuis leur ${scopeS}.`;
  const copyCaptionS = `Les listes et leurs annotations sont dupliquées dans ce ${scopeS}, dont vous devenez propriétaire.`;

  // data

  const jwt = useSelector((s) => s.auth.jwt);
  const { candidates, loading } = useSourceScopeCandidates({
    projectId,
    enabled: open,
  });

  // state

  const [download, setDownload] = useState(null); // { scopeId, status, progress }
  const [downloadError, setDownloadError] = useState(null);

  // helpers — candidates split (suggested = installed scopes created from
  // one of the configuration's sourceConfigurationKeys, most recent first)

  const { suggested, others } = useMemo(() => {
    const keys = sourceConfigurationKeys ?? [];
    const suggested = candidates
      .filter((c) => c.configurationKey && keys.includes(c.configurationKey))
      .sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      );
    const others = candidates
      .filter((c) => !suggested.includes(c))
      .sort(
        (a, b) =>
          Number(b.isLocal) - Number(a.isLocal) ||
          (a.name ?? "").localeCompare(b.name ?? "")
      );
    return { suggested, others };
  }, [candidates, (sourceConfigurationKeys ?? []).join(",")]);

  const sourceScopeId = sourceScope?.scopeId ?? null;
  const mode = sourceScope?.mode ?? SOURCE_SCOPE_MODES.LINK;
  const selectedCandidate =
    candidates.find((c) => c.scopeId === sourceScopeId) ?? null;
  const isInstalled = Boolean(selectedCandidate?.isLocal);
  const isDownloading = Boolean(download && download.scopeId === sourceScopeId);

  // helpers — the source scope's own drawing listings

  const entityModelsObject = appConfig?.entityModelsObject;
  const listings =
    useLiveQuery(async () => {
      if (!sourceScopeId || !isInstalled) return EMPTY_LISTINGS;
      const rows = await getSourceScopeListings({ sourceScopeId, appConfig });
      return rows
        .map((l) => ({
          ...l,
          entityModel:
            l.entityModel ?? entityModelsObject?.[l.entityModelKey] ?? null,
        }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }, [sourceScopeId, isInstalled, Boolean(entityModelsObject)]) ??
    EMPTY_LISTINGS;

  const countById = useListingItemsCountById(listings);

  const selectedListingIds = listings
    .map((l) => l.id)
    .filter(
      (id) =>
        sourceScope?.listingIds == null || sourceScope.listingIds.includes(id)
    );

  const ready = isInstalled && selectedListingIds.length > 0;

  // effects

  // preselect the most recent suggested scope once the scopes are known
  useEffect(() => {
    if (!open || sourceScope != null || loading) return;
    onSourceScopeChange({
      scopeId: suggested[0]?.scopeId ?? null,
      mode: SOURCE_SCOPE_MODES.LINK,
      listingIds: null,
    });
  }, [open, sourceScope, loading]);

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready]);

  // handlers

  function handleScopeChange(e) {
    setDownloadError(null);
    onSourceScopeChange({
      scopeId: e.target.value || null,
      mode,
      listingIds: null,
    });
  }

  function handleModeChange(e) {
    onSourceScopeChange({
      scopeId: sourceScopeId,
      mode: e.target.value,
      listingIds: sourceScope?.listingIds ?? null,
    });
  }

  function handleListingToggle(listingId) {
    const next = selectedListingIds.includes(listingId)
      ? selectedListingIds.filter((id) => id !== listingId)
      : [...selectedListingIds, listingId];
    onSourceScopeChange({ scopeId: sourceScopeId, mode, listingIds: next });
  }

  async function handleDownload() {
    if (!sourceScopeId || download) return;
    const scopeId = sourceScopeId;
    setDownloadError(null);
    setDownload({ scopeId, status: "fetching_metadata", progress: 0 });
    try {
      const { configuration } = await downloadRemoteScopeService({
        scopeId,
        appConfig,
        jwt,
        // the scope was listed for this project: install it there
        projectId,
        onProgress: ({ status, progress }) =>
          setDownload({ scopeId, status, progress }),
      });
      // installed at the remote version: not "behind" at its first opening
      setSyncedVersionToStorage(scopeId, configuration?.version);
    } catch (error) {
      console.error("[SectionKrtoSource] download failed", error);
      setDownloadError(error?.message || downloadErrorS);
    } finally {
      setDownload(null);
    }
  }

  // render

  function renderScopeItem(candidate) {
    return (
      <MenuItem
        key={candidate.scopeId}
        value={candidate.scopeId}
        dense
        sx={{ gap: 1 }}
      >
        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {candidate.name}
        </Typography>
        {!candidate.isLocal && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              color: "text.secondary",
              flexShrink: 0,
            }}
          >
            <Typography variant="caption">{notInstalledTagS}</Typography>
            <CloudQueueIcon sx={{ fontSize: 16 }} />
          </Box>
        )}
      </MenuItem>
    );
  }

  function renderModeOption({ value, label, caption }) {
    return (
      <FormControlLabel
        value={value}
        control={<Radio size="small" color="secondary" sx={{ p: 0.5 }} />}
        disabled={!ready || disabled}
        sx={{ alignItems: "flex-start", ml: 0, mr: 0 }}
        label={
          <Box sx={{ pt: 0.5 }}>
            <Typography variant="body2">{label}</Typography>
            <Typography
              variant="caption"
              sx={{ display: "block", color: "text.secondary" }}
            >
              {caption}
            </Typography>
          </Box>
        }
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {sourceS}
        </Typography>
        {required && !ready && (
          <Typography variant="caption" sx={{ color: "warning.main" }}>
            {requiredS}
          </Typography>
        )}
      </Box>
      <Box sx={sectionCardSx}>
        <Select
          size="small"
          fullWidth
          displayEmpty
          disabled={disabled || isDownloading}
          value={selectedCandidate ? sourceScopeId : ""}
          onChange={handleScopeChange}
          renderValue={() => (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  flex: 1,
                  minWidth: 0,
                  color: selectedCandidate ? "text.primary" : "text.secondary",
                }}
              >
                {selectedCandidate?.name ?? (required ? pickS : noneS)}
              </Typography>
              {selectedCandidate && !selectedCandidate.isLocal && (
                <CloudQueueIcon
                  sx={{ fontSize: 16, color: "text.secondary" }}
                />
              )}
            </Box>
          )}
          sx={{ fontSize: 13 }}
        >
          {!required && (
            <MenuItem value="" dense>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {noneS}
              </Typography>
            </MenuItem>
          )}
          {suggested.length > 0 && (
            <ListSubheader disableSticky sx={{ lineHeight: "28px" }}>
              {suggestedS}
            </ListSubheader>
          )}
          {suggested.map(renderScopeItem)}
          {suggested.length > 0 && others.length > 0 && (
            <ListSubheader disableSticky sx={{ lineHeight: "28px" }}>
              {othersS}
            </ListSubheader>
          )}
          {others.map(renderScopeItem)}
        </Select>
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.secondary", mt: 0.5 }}
        >
          {hintS}
        </Typography>

        {/* scope not installed on this device: download it (not opened) */}
        {selectedCandidate && !isInstalled && (
          <Box
            sx={{
              mt: 1,
              p: 1,
              borderRadius: 1.5,
              bgcolor: "action.hover",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                {isDownloading
                  ? download.status === "importing"
                    ? importingS
                    : downloadingS
                  : notInstalledS}
              </Typography>
              <ButtonGeneric
                size="small"
                variant="contained"
                color="secondary"
                startIcon={<CloudDownloadOutlinedIcon />}
                onClick={handleDownload}
                loading={isDownloading}
                disabled={disabled || Boolean(download)}
                label={
                  selectedCandidate.fileSize
                    ? `${downloadS} (${stringifyFileSize(selectedCandidate.fileSize)})`
                    : downloadS
                }
                sx={{ flexShrink: 0, textTransform: "none" }}
              />
            </Box>
            {isDownloading && (
              <LinearProgress
                variant="determinate"
                color="secondary"
                value={download.progress ?? 0}
                sx={{ height: 4, borderRadius: 2 }}
              />
            )}
            {downloadError && !isDownloading && (
              <Typography variant="caption" sx={{ color: "error.main" }}>
                {downloadError}
              </Typography>
            )}
          </Box>
        )}

        {/* listings of the installed source scope */}
        {isInstalled && (
          <Box sx={{ mt: 1 }}>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "text.secondary",
                fontWeight: 600,
              }}
            >
              {listingsS}
            </Typography>
            {listings.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {noListingS}
              </Typography>
            ) : (
              listings.map((listing) => {
                const checked = selectedListingIds.includes(listing.id);
                return (
                  <Box
                    key={listing.id}
                    onClick={() => !disabled && handleListingToggle(listing.id)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      py: 0.25,
                      cursor: disabled ? "default" : "pointer",
                    }}
                  >
                    <Checkbox
                      size="small"
                      color="secondary"
                      checked={checked}
                      readOnly
                      disabled={disabled}
                      sx={{ p: 0.5 }}
                    />
                    <AvatarListing
                      listing={listing}
                      size={24}
                      variant={checked ? "visible" : "muted"}
                    />
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ flex: 1, minWidth: 0 }}
                    >
                      {listing.name ?? listing.label ?? "Liste"}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", flexShrink: 0 }}
                    >
                      {annotationsCountS(countById?.[listing.id] ?? 0)}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        )}

        <RadioGroup
          value={mode}
          onChange={handleModeChange}
          sx={{ mt: 1, gap: 0.5 }}
        >
          {renderModeOption({
            value: SOURCE_SCOPE_MODES.LINK,
            label: linkS,
            caption: linkCaptionS,
          })}
          {renderModeOption({
            value: SOURCE_SCOPE_MODES.COPY,
            label: copyS,
            caption: copyCaptionS,
          })}
        </RadioGroup>
      </Box>
    </Box>
  );
}
