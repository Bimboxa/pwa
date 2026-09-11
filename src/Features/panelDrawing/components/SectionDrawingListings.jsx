import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setHiddenListingsIds,
  setSelectedListingId,
} from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  Chip,
  IconButton,
  List,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import AvatarListing from "Features/listings/components/AvatarListing";

import useListings from "Features/listings/hooks/useListings";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

// ---------------------------------------------------------------------------
// SectionDrawingListings — "Listes d'annotations" card of the Dessin module
// default panel: one row per listing of the scope with its annotations count
// (scoped to the main base map, like PanelDrawing) and a visibility eye.
// Clicking a row selects the listing (its properties panel opens) and makes
// it the active listing of the Dessin panel — same as the popper ListingRow.
// ---------------------------------------------------------------------------

export default function SectionDrawingListings() {
  // strings

  const titleS = "Listes d'annotations";
  const showS = "Afficher";
  const hideS = "Masquer";
  const emptyS = "Aucune liste d'annotations.";

  // data

  const dispatch = useDispatch();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // Same scope as PanelDrawing counts (main base map, scope listings,
  // eye-hidden templates kept so hidden rows stay countable). No qties: the
  // card only needs a count.
  const annotations = useAnnotationsV2({
    caller: "SectionDrawingListings",
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    hideBaseMapAnnotations: true,
    excludeIsForBaseMapsListings: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
  });

  // helpers - listings (rank order from the selector; the system "Générique"
  // listing stays pinned first only while it has no rank — same rule as
  // PanelDrawing)

  const displayedListings = useMemo(() => {
    const pinnedSystemListings =
      listings?.filter((l) => l.isFreeAnnotationsListing && l.rank == null) ??
      [];
    const otherListings =
      listings?.filter(
        (l) => !(l.isFreeAnnotationsListing && l.rank == null)
      ) ?? [];
    return [...pinnedSystemListings, ...otherListings];
  }, [listings]);

  // helpers - counts (mesh cells excluded, like computeAnnotationTemplateQties)

  const countsByListingId = useMemo(() => {
    const counts = {};
    for (const a of annotations ?? []) {
      if (a.isMeshCell || !a.listingId) continue;
      counts[a.listingId] = (counts[a.listingId] ?? 0) + 1;
    }
    return counts;
  }, [annotations]);

  // handlers

  function handleSelectListing(listing) {
    dispatch(setSelectedListingId(listing.id));
    dispatch(
      setSelectedItem({
        id: listing.id,
        type: "LISTING",
        listingId: listing.id,
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleToggleVisibility(e, listingId) {
    e.stopPropagation();
    const hidden = hiddenListingsIds.includes(listingId);
    dispatch(
      setHiddenListingsIds(
        hidden
          ? hiddenListingsIds.filter((id) => id !== listingId)
          : [...hiddenListingsIds, listingId]
      )
    );
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
        {titleS}
      </Typography>

      {displayedListings.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {emptyS}
        </Typography>
      )}

      <List dense disablePadding>
        {displayedListings.map((listing) => {
          const hidden = hiddenListingsIds.includes(listing.id);
          const active = listing.id === selectedListingId;
          const count = countsByListingId[listing.id] ?? 0;
          return (
            <ListItemButton
              key={listing.id}
              onClick={() => handleSelectListing(listing)}
              sx={{
                gap: 1,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                // Active listing flag: secondary left border, always there so
                // selecting never shifts the row.
                borderLeft: "3px solid",
                borderLeftColor: active ? "secondary.main" : "transparent",
              }}
            >
              <AvatarListing
                listing={listing}
                size={24}
                variant={
                  active
                    ? "selected"
                    : hidden || count === 0
                      ? "muted"
                      : "visible"
                }
              />
              <Typography
                variant="body2"
                noWrap
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: active ? 600 : 400,
                  color: hidden ? "text.disabled" : "text.primary",
                }}
              >
                {listing.name ?? listing.label ?? "Liste"}
              </Typography>
              <Chip
                label={count}
                size="small"
                sx={{
                  height: 16,
                  flexShrink: 0,
                  "& .MuiChip-label": {
                    px: 0.75,
                    fontSize: "10px",
                    fontFamily: "monospace",
                    fontWeight: 500,
                    color: hidden
                      ? "text.disabled"
                      : count > 0
                        ? "secondary.main"
                        : "panel.countEmpty",
                  },
                }}
              />
              <Tooltip title={hidden ? showS : hideS} arrow>
                <IconButton
                  size="small"
                  onClick={(e) => handleToggleVisibility(e, listing.id)}
                  sx={{
                    p: 0.5,
                    flexShrink: 0,
                    color: hidden ? "secondary.main" : "panel.iconMuted",
                  }}
                >
                  {hidden ? (
                    <VisibilityOff sx={{ fontSize: 16 }} />
                  ) : (
                    <Visibility sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Tooltip>
            </ListItemButton>
          );
        })}
      </List>
    </WhiteSectionGeneric>
  );
}
