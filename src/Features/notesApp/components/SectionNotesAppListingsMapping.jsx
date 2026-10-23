import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { selectModuleIconKeysByKey } from "Features/scopeConfig/utils/scopeConfigSelectors";

import { Box, CircularProgress, Tooltip, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import resolveBusinessObjectType from "Features/businessObjects/utils/resolveBusinessObjectType";
import getBusinessObjectTypeOfListing from "Features/businessObjects/utils/getBusinessObjectTypeOfListing";
import { getBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import { getModuleIconComponent } from "Features/viewers/data/moduleIconsMap";

import useNotesAppScopeLink from "../hooks/useNotesAppScopeLink";
import fetchNotesAppListings from "../services/fetchNotesAppListings";
import getNotesAppBusinessObjectType from "../utils/getNotesAppBusinessObjectType";
import { clearNotesAppListingMapping } from "../utils/resolveNotesAppScopeLink";
import ToggleButtonGroupMappingTarget, {
  IGNORE,
  LINK,
} from "./ToggleButtonGroupMappingTarget";

const CREATE = "__CREATE__";

// Mapping table between the linked notes-app project's lists and the scope's
// listings. One row per remote list: name + last sync count on top, target
// picker below — "+ <type icon> <list label>" (a linked listing of the business object type the sync
// creates), another listing of the scope picked from the dropdown, or
// ignore. Ignoring keeps the local listing id, so re-linking does not create
// a duplicate. Plans have their own table (SectionNotesAppBaseMapsMapping).
export default function SectionNotesAppListingsMapping({ appName = "Krnet" }) {
  // strings

  const titleS = `Listes ${appName} → listes d'ouvrages de la mission`;
  const errorS = "Impossible de récupérer les listes.";

  // data

  const { scope, link, setListingMapping } = useNotesAppScopeLink();
  const { value: scopeListings } = useListingsByScope();
  const appConfigStringsByType = useSelector(
    (s) => s.appConfig.value?.strings?.businessObjectTypes
  );
  const moduleIconKeysByKey = useSelector(selectModuleIconKeysByKey);
  const refreshKey = useSelector((s) => s.notesApp.remoteRefreshKey);

  // state

  const [remoteListings, setRemoteListings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // effects - fetch the remote lists of the linked project

  useEffect(() => {
    if (!link?.projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchNotesAppListings(link.projectId)
      .then((items) => {
        if (!cancelled) setRemoteListings(items);
      })
      .catch((e) => {
        console.log("[notesApp] fetch remote listings failed", e);
        if (!cancelled) setError(errorS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [link?.projectId, refreshKey]);

  // helpers

  // Targets = the scope's "Ouvrages" listings (business objects tree).
  const targetListings = (scopeListings ?? []).filter(
    (l) => l.entityModelKey === "businessObject" && !l.deletedAt
  );

  const getEntry = (remoteListing) =>
    link?.listingsMapping?.find((m) => m.remoteListingId === remoteListing.id);

  // A mapped listing deleted since reads as unmapped (the sync orchestrator
  // creates a new one, same rule).
  const getLocalListing = (entry) =>
    entry?.localListingId
      ? targetListings.find((l) => l.id === entry.localListingId)
      : null;

  const getRowValue = (remoteListing) =>
    getEntry(remoteListing)?.mode === "ignored" ? IGNORE : LINK;

  // Same icon as the type's module in the left band (scope override first).
  const getTypeIcon = (typeKey, defaultIconKey) => {
    const Icon = getModuleIconComponent(
      moduleIconKeysByKey[getBusinessObjectsModuleKey(typeKey)],
      defaultIconKey
    );
    return <Icon fontSize="small" />;
  };

  const getCreateType = (remoteListing) =>
    resolveBusinessObjectType({
      typeKey: getNotesAppBusinessObjectType(remoteListing.settings),
      appConfigStringsByType,
    });

  const getListingType = (listing) =>
    resolveBusinessObjectType({
      typeKey: getBusinessObjectTypeOfListing(listing).key,
      appConfigStringsByType,
    });

  // "32 localisations", "1 matériau"
  const getObjectsCountS = (count, type) => {
    const { objectLabel, objectsLabel } = type.strings;
    const label = count > 1 ? (objectsLabel ?? `${objectLabel}s`) : objectLabel;
    return `${count} ${label.toLowerCase()}`;
  };

  const getCountTooltipS = (counts, type) => {
    const entitiesS = getObjectsCountS(counts.entities ?? 0, type);
    const positions = counts.positions ?? 0;
    if (!positions) return entitiesS;
    return `${entitiesS}, ${positions} position${positions > 1 ? "s" : ""}`;
  };

  const getListingIcon = (listing) => {
    const type = getBusinessObjectTypeOfListing(listing);
    return getTypeIcon(type.key, type.defaultIconKey);
  };

  // handlers

  async function handleLink(remoteListing) {
    const localListing = getLocalListing(getEntry(remoteListing));
    await handleSelect(remoteListing, localListing?.id ?? CREATE);
  }

  async function handleIgnore(remoteListing) {
    const localListing = getLocalListing(getEntry(remoteListing));
    try {
      await setListingMapping({
        remoteListingId: remoteListing.id,
        remoteListingName: remoteListing.name,
        localListingId: localListing?.id ?? null,
        mode: "ignored",
      });
    } catch (e) {
      console.log("[notesApp] set mapping failed", e);
    }
  }

  async function handleSelect(remoteListing, key) {
    try {
      if (key === CREATE) {
        // absence of entry = default "create a linked listing" at sync time
        await clearNotesAppListingMapping({
          scope,
          remoteListingId: remoteListing.id,
        });
      } else {
        await setListingMapping({
          remoteListingId: remoteListing.id,
          remoteListingName: remoteListing.name,
          localListingId: key,
          mode: "mapped",
        });
      }
    } catch (e) {
      console.log("[notesApp] set mapping failed", e);
    }
  }

  // render

  if (!link?.projectId) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 1, pt: 1 }}
      >
        {titleS}
      </Typography>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {!loading && error && (
        <Typography variant="caption" color="error" sx={{ px: 1 }}>
          {error}
        </Typography>
      )}

      {!loading && !error && remoteListings?.length > 0 && (
        <Box
          sx={{
            overflow: "auto",
            mx: 1,
            my: 0.5,
            bgcolor: "white",
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
          }}
        >
          {remoteListings.map((remoteListing, index) => {
            const entry = getEntry(remoteListing);
            const value = getRowValue(remoteListing);
            const localListing = getLocalListing(entry);
            const createType = getCreateType(remoteListing);
            const createIcon = getTypeIcon(
              createType.key,
              createType.defaultIconKey
            );
            const createS = `+ ${createType.strings.listLabel}`;
            const countType = localListing
              ? getListingType(localListing)
              : createType;
            return (
              <Box
                key={remoteListing.id}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  px: 1,
                  py: 0.75,
                  borderTop: (theme) =>
                    index > 0 ? `1px solid ${theme.palette.divider}` : "none",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 1,
                    minWidth: 0,
                  }}
                >
                  <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                    {remoteListing.name}
                  </Typography>
                  {entry?.lastSyncCounts && (
                    <Tooltip
                      title={getCountTooltipS(entry.lastSyncCounts, countType)}
                    >
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ flexShrink: 0 }}
                      >
                        {entry.lastSyncCounts.entities ?? 0}
                      </Typography>
                    </Tooltip>
                  )}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <ToggleButtonGroupMappingTarget
                    value={value}
                    linkContent={
                      <>
                        {!localListing && <Add fontSize="small" />}
                        {localListing
                          ? getListingIcon(localListing)
                          : createIcon}
                        <Box
                          component="span"
                          sx={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {localListing
                            ? localListing.name
                            : createType.strings.listLabel}
                        </Box>
                      </>
                    }
                    linkTooltip={localListing ? localListing.name : createS}
                    menuItems={[
                      {
                        key: CREATE,
                        label: createS,
                        icon: createIcon,
                        selected: value === LINK && !localListing,
                      },
                      ...targetListings.map((listing) => ({
                        key: listing.id,
                        label: listing.name,
                        icon: getListingIcon(listing),
                        selected:
                          value === LINK && localListing?.id === listing.id,
                      })),
                    ]}
                    onLink={() => handleLink(remoteListing)}
                    onIgnore={() => handleIgnore(remoteListing)}
                    onSelectMenuItem={(key) => handleSelect(remoteListing, key)}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
