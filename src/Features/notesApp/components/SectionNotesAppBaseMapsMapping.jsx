import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, CircularProgress, Typography } from "@mui/material";
import { Map as MapIcon } from "@mui/icons-material";

import db from "App/db/db";

import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import useNotesAppScopeLink from "../hooks/useNotesAppScopeLink";
import fetchNotesAppBaseMaps from "../services/fetchNotesAppBaseMaps";
import { clearNotesAppBaseMapMapping } from "../utils/resolveNotesAppScopeLink";
import ToggleButtonGroupMappingTarget, {
  IGNORE,
  LINK,
} from "./ToggleButtonGroupMappingTarget";

const DEFAULT = "__DEFAULT__";

// Mapping table between the linked notes-app project's plans and the
// project's base-map listings. One row per remote plan (name on top, target
// picker below); target = a base-map listing of the project, picked from the
// dropdown (default = the "Fonds de plan" listing, created at sync time when
// the project has none) or ignore. Ignoring keeps the picked listing, so
// re-linking restores it. The sync moves an already
// imported plan when its target changes. Local status + the plan's Krnet
// locations (resolved to business objects) are shown under the name.
export default function SectionNotesAppBaseMapsMapping({ appName = "Krnet" }) {
  // strings

  const titleS = `Plans ${appName} → fonds de plan de la mission`;
  const createS = "Créer une liste « Fonds de plan »";
  const createShortS = "+ Fonds de plan";
  const ignoreS = "Ignorer";
  const errorS = "Impossible de récupérer les plans.";
  const emptyS = `Aucun plan dans le dossier ${appName}.`;
  const importedS = "Importé dans";
  const notImportedS = "Non importé";
  const noImageS = "Sans image (non importable)";
  const ignoredS = "Ignoré";
  const locationsS = "Localisations";

  // data

  const { scope, link, setBaseMapMapping } = useNotesAppScopeLink();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const refreshKey = useSelector((s) => s.notesApp.remoteRefreshKey);
  const targetListings = useProjectBaseMapListings() ?? [];
  const defaultListing =
    targetListings.find((l) => l.key === "mapsGeneric") ?? targetListings[0];

  const localByIdMaster = useLiveQuery(async () => {
    if (!projectId) return new Map();
    const rows = await db.baseMaps
      .where("projectId")
      .equals(projectId)
      .toArray();
    return new Map(
      rows
        .filter(
          (b) => !b.deletedAt && b.remoteSource === "notesApp" && b.idMaster
        )
        .map((b) => [b.idMaster, b])
    );
  }, [projectId]);

  const objectLabelById = useLiveQuery(async () => {
    if (!projectId) return new Map();
    const rows = await db.businessObjects
      .where("projectId")
      .equals(projectId)
      .toArray();
    return new Map(
      rows.filter((o) => !o.deletedAt).map((o) => [o.id, o.label])
    );
  }, [projectId]);

  // state

  const [remoteBaseMaps, setRemoteBaseMaps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // effects - fetch the remote plans of the linked project

  useEffect(() => {
    if (!link?.projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchNotesAppBaseMaps(link.projectId)
      .then((items) => {
        if (!cancelled) {
          setRemoteBaseMaps(
            [...items].sort((a, b) =>
              String(a.name ?? "").localeCompare(String(b.name ?? ""))
            )
          );
        }
      })
      .catch((e) => {
        console.log("[notesApp] fetch remote base maps failed", e);
        if (!cancelled) setError(errorS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [link?.projectId, link?.lastSyncAt, refreshKey]);

  // helpers

  const getEntry = (remote) =>
    link?.baseMapsMapping?.find((m) => m.remoteBaseMapId === remote.id);

  const getRowValue = (remote) =>
    getEntry(remote)?.mode === "ignored" ? IGNORE : LINK;

  // Target listing key (kept while ignored). A mapped listing deleted since
  // falls back to the default (the sync orchestrator applies the same rule).
  const getTargetKey = (remote) => {
    const entry = getEntry(remote);
    const stillExists = targetListings.some(
      (l) => l.id === entry?.localListingId
    );
    if (!stillExists || entry.localListingId === defaultListing?.id)
      return DEFAULT;
    return entry.localListingId;
  };

  const getTargetListing = (targetKey) =>
    targetKey === DEFAULT
      ? defaultListing
      : targetListings.find((l) => l.id === targetKey);

  const getStatusS = (remote) => {
    const entry = getEntry(remote);
    if (entry?.mode === "ignored") return ignoredS;
    const local = localByIdMaster?.get(remote.id);
    if (local) {
      const listing = targetListings.find((l) => l.id === local.listingId);
      return listing ? `${importedS} ${listing.name}` : importedS;
    }
    return remote.imageStoragePath ? notImportedS : noImageS;
  };

  const getLocationsS = (remote) => {
    const local = localByIdMaster?.get(remote.id);
    const ids = local?.notesAppLocationBusinessObjectIds ?? [];
    const labels = ids.map((id) => objectLabelById?.get(id)).filter(Boolean);
    if (labels.length === 0) return null;
    const shown = labels.slice(0, 3).join(", ");
    const more = labels.length > 3 ? ` +${labels.length - 3}` : "";
    return `${locationsS} : ${shown}${more}`;
  };

  // handlers

  async function handleIgnore(remote) {
    const targetKey = getTargetKey(remote);
    try {
      await setBaseMapMapping({
        remoteBaseMapId: remote.id,
        remoteBaseMapName: remote.name,
        localListingId: targetKey === DEFAULT ? null : targetKey,
        mode: "ignored",
      });
    } catch (e) {
      console.log("[notesApp] set base map mapping failed", e);
    }
  }

  async function handleTargetChange(remote, value) {
    try {
      if (value === DEFAULT) {
        // absence of entry = default "Fonds de plan" listing at sync time
        await clearNotesAppBaseMapMapping({
          scope,
          remoteBaseMapId: remote.id,
        });
      } else {
        await setBaseMapMapping({
          remoteBaseMapId: remote.id,
          remoteBaseMapName: remote.name,
          localListingId: value,
          mode: "mapped",
        });
      }
    } catch (e) {
      console.log("[notesApp] set base map mapping failed", e);
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

      {!loading && !error && remoteBaseMaps?.length === 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 1, py: 0.5 }}
        >
          {emptyS}
        </Typography>
      )}

      {!loading && !error && remoteBaseMaps?.length > 0 && (
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
          {remoteBaseMaps.map((remote, index) => {
            const locationsS = getLocationsS(remote);
            const targetKey = getTargetKey(remote);
            const targetListing = getTargetListing(targetKey);
            const value = getRowValue(remote);
            return (
              <Box
                key={remote.id}
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
                    alignItems: "center",
                    gap: 1,
                    minWidth: 0,
                  }}
                >
                  <MapIcon fontSize="small" color="action" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {remote.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: "block" }}
                    >
                      {getStatusS(remote)}
                    </Typography>
                    {locationsS && (
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        noWrap
                        sx={{ display: "block" }}
                      >
                        {locationsS}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <ToggleButtonGroupMappingTarget
                    value={value}
                    linkContent={
                      <Box
                        component="span"
                        sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {targetListing?.name ?? createShortS}
                      </Box>
                    }
                    linkTooltip={targetListing ? targetListing.name : createS}
                    ignoreLabel={ignoreS}
                    menuItems={[
                      ...(defaultListing
                        ? []
                        : [
                            {
                              key: DEFAULT,
                              label: createS,
                              selected: value === LINK,
                            },
                          ]),
                      ...targetListings.map((listing) => {
                        const key =
                          listing.id === defaultListing?.id
                            ? DEFAULT
                            : listing.id;
                        return {
                          key,
                          label: listing.name,
                          selected: value === LINK && key === targetKey,
                        };
                      }),
                    ]}
                    onLink={() => handleTargetChange(remote, targetKey)}
                    onIgnore={() => handleIgnore(remote)}
                    onSelectMenuItem={(key) => handleTargetChange(remote, key)}
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
