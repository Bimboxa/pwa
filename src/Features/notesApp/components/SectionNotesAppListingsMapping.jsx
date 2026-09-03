import { useEffect, useState } from "react";

import {
  Box,
  CircularProgress,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { Map as MapIcon } from "@mui/icons-material";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import useNotesAppScopeLink from "../hooks/useNotesAppScopeLink";
import fetchNotesAppListings from "../services/fetchNotesAppListings";
import { clearNotesAppListingMapping } from "../utils/resolveNotesAppScopeLink";

const CREATE = "__CREATE__";
const IGNORE = "__IGNORE__";

// Mapping table between the linked notes-app project's lists and the scope's
// listings. One row per remote list; target = create a linked listing
// (default), an existing listing of the scope, or ignore. Plans are not
// mapped row by row: a fixed info row reminds they all land in the project's
// "Fonds de plan" listing.
export default function SectionNotesAppListingsMapping({ appName = "Krnet" }) {
  // strings

  const titleS = `Listes ${appName} → listes d'ouvrages de la mission`;
  const createS = "Créer une liste d'ouvrages";
  const ignoreS = "Ignorer";
  const plansS = "Plans";
  const plansTargetS = "→ Fonds de plan";
  const errorS = "Impossible de récupérer les listes.";

  // data

  const { scope, link, setListingMapping } = useNotesAppScopeLink();
  const { value: scopeListings } = useListingsByScope();

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
  }, [link?.projectId]);

  // helpers

  // Targets = the scope's "Ouvrages" listings (business objects tree).
  const targetListings = (scopeListings ?? []).filter(
    (l) => l.entityModelKey === "businessObject" && !l.deletedAt
  );

  const getRowValue = (remoteListing) => {
    const entry = link?.listingsMapping?.find(
      (m) => m.remoteListingId === remoteListing.id
    );
    if (!entry) return CREATE;
    if (entry.mode === "ignored") return IGNORE;
    // A mapped listing deleted since: fall back to CREATE (the sync
    // orchestrator applies the same rule).
    const stillExists = targetListings.some((l) => l.id === entry.localListingId);
    return stillExists ? entry.localListingId : CREATE;
  };

  // handlers

  async function handleTargetChange(remoteListing, value) {
    try {
      if (value === CREATE) {
        // absence of entry = default "create a linked listing" at sync time
        await clearNotesAppListingMapping({
          scope,
          remoteListingId: remoteListing.id,
        });
      } else if (value === IGNORE) {
        await setListingMapping({
          remoteListingId: remoteListing.id,
          remoteListingName: remoteListing.name,
          localListingId: null,
          mode: "ignored",
        });
      } else {
        await setListingMapping({
          remoteListingId: remoteListing.id,
          remoteListingName: remoteListing.name,
          localListingId: value,
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
      <Typography variant="caption" color="text.secondary" sx={{ px: 1, pt: 1 }}>
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

      {!loading && !error && (
        <Box sx={{ overflow: "auto", px: 1, py: 0.5 }}>
          {(remoteListings ?? []).map((remoteListing) => {
            const entry = link?.listingsMapping?.find(
              (m) => m.remoteListingId === remoteListing.id
            );
            return (
              <Box
                key={remoteListing.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  py: 0.5,
                }}
              >
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="body2" noWrap>
                    {remoteListing.name}
                  </Typography>
                  {entry?.lastSyncCounts && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {`${entry.lastSyncCounts.entities ?? 0} ouvrage(s), ${
                        entry.lastSyncCounts.positions ?? 0
                      } position(s)`}
                    </Typography>
                  )}
                </Box>
                <Select
                  size="small"
                  value={getRowValue(remoteListing)}
                  onChange={(e) =>
                    handleTargetChange(remoteListing, e.target.value)
                  }
                  sx={{ minWidth: 140, maxWidth: 160 }}
                >
                  <MenuItem value={CREATE}>{createS}</MenuItem>
                  <MenuItem value={IGNORE}>{ignoreS}</MenuItem>
                  {targetListings.map((listing) => (
                    <MenuItem key={listing.id} value={listing.id}>
                      {listing.name}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            );
          })}

          {/* fixed info row: plans always land in the base-map listing */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              py: 0.5,
              opacity: 0.7,
            }}
          >
            <MapIcon fontSize="small" color="action" />
            <Typography variant="body2">{plansS}</Typography>
            <Typography variant="caption" color="text.secondary">
              {plansTargetS}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
