import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";
import { setListingsPanelExpanded } from "Features/popperMapListings/popperMapListingsSlice";

import { Box, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Add from "@mui/icons-material/Add";
import MoreHoriz from "@mui/icons-material/MoreHoriz";

import AvatarListing from "Features/listings/components/AvatarListing";
import DialogChooseListingSource from "Features/listings/components/DialogChooseListingSource";
import useLinkedListings from "Features/listings/hooks/useLinkedListings";
import SectionPopperListings from "Features/popperMapListings/components/SectionPopperListings";
import ButtonCountPill from "Features/popperMapListings/components/ButtonCountPill";
import MenuMoreActionsActiveListing from "./MenuMoreActionsActiveListing";

import bandButtonSx from "Features/popperMapListings/utils/bandButtonSx";

// ---------------------------------------------------------------------------
// BandActiveListing — active listing block of the Dessin popper and of the
// docked Dessin panel (PanelDrawing), right under the header and above the
// templates of the active listing:
// 1. the "Listes d'annotations" header: a "+" (new listing) and the
//    expand / collapse button of the listings panel (SectionPopperListings:
//    select, solo, show / hide, reorder, create), shown between the header
//    and the band — expanded by default;
// 2. the active listing band (highlighted like the selected base map row):
//    the listing avatar, its full name, the "..." menu and, at the end of the
//    row, its annotations count as a pill that toggles the listing visibility
//    (same badge as the base map selector of the top bar).
// The expanded state lives in redux (popperMapListings.listingsPanelExpanded)
// so it survives the popper remount between the 2D and 3D editors.
// ---------------------------------------------------------------------------

// The panel lives in the non-scrollable block of the popper, above the
// templates area: capped so a long list never pushes the templates out of
// sight.
const PANEL_MAX_HEIGHT = 240;

export default function BandActiveListing({
  listings,
  activeListing,
  countsByListingId,
  showAddListing = true,
}) {
  const dispatch = useDispatch();

  // strings

  const listingsS = "Listes d'annotations";
  const expandS = "Déplier les listes";
  const collapseS = "Replier les listes";
  const addListingS = "Nouvelle liste";
  const moreS = "Actions sur la liste active";
  const hideListingS = "Masquer la liste";
  const showListingS = "Afficher la liste";

  // data

  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const expanded = useSelector(
    (s) => s.popperMapListings.listingsPanelExpanded
  );

  const { isLinkedListing } = useLinkedListings();

  // state

  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [openCreateListing, setOpenCreateListing] = useState(false);

  // helpers

  const activeListingId = activeListing?.id;

  const activeCount = activeListingId
    ? (countsByListingId?.[activeListingId] ?? 0)
    : 0;
  const activeHidden = activeListingId
    ? hiddenListingsIds.includes(activeListingId)
    : false;

  // handlers

  const toggleVisibility = (listingId) => {
    const isHidden = hiddenListingsIds.includes(listingId);
    dispatch(
      setHiddenListingsIds(
        isHidden
          ? hiddenListingsIds.filter((id) => id !== listingId)
          : [...hiddenListingsIds, listingId]
      )
    );
  };

  const handleToggleExpanded = () => {
    dispatch(setListingsPanelExpanded(!expanded));
  };

  // render

  return (
    <Box>
      {/* "Listes" header: title, then the "+" and the expand / collapse
          button of the listings panel. */}
      <Box
        onClick={handleToggleExpanded}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 1.5,
          pr: 1,
          py: 0.5,
          cursor: "pointer",
          userSelect: "none",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          // Same tinted background on both hosts (the docked panel's and
          // the white popper's): the header and the listings panel read as
          // one block above the white templates list.
          bgcolor: "background.default",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Typography
          variant="caption"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 600,
            color: "panel.textMuted",
          }}
        >
          {listingsS}
        </Typography>

        {showAddListing && (
          <Tooltip title={addListingS} arrow placement="top">
            <Box
              component="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenCreateListing(true);
              }}
              sx={bandButtonSx}
            >
              <Add sx={{ fontSize: 18 }} />
            </Box>
          </Tooltip>
        )}

        <Tooltip title={expanded ? collapseS : expandS} arrow placement="top">
          <Box
            component="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpanded();
            }}
            sx={bandButtonSx}
          >
            {expanded ? (
              <ExpandLess sx={{ fontSize: 18 }} />
            ) : (
              <ExpandMore sx={{ fontSize: 18 }} />
            )}
          </Box>
        </Tooltip>
      </Box>

      {/* Listings panel, between the header and the active listing band. */}
      {expanded && (
        <Box
          sx={{
            maxHeight: PANEL_MAX_HEIGHT,
            overflow: "auto",
            borderBottom: "1px solid",
            borderColor: "panel.border",
            bgcolor: "background.default",
          }}
        >
          <SectionPopperListings
            listings={listings}
            activeListing={activeListing}
            countsByListingId={countsByListingId}
            showAddListing={showAddListing}
          />
        </Box>
      )}

      {/* Active listing band, highlighted like the selected base map row
          (RowBaseMapInList): secondary tint + 3px secondary left border,
          listing avatar, full name in secondary (several lines rather than
          an ellipsis), the "..." menu button, then the annotations count
          pill toggling the listing visibility. Hidden while the listings
          panel is expanded: its selected row already shows the same. */}
      {activeListing && !expanded && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            pl: 1,
            pr: 2,
            py: 0.75,
            borderLeft: "3px solid",
            borderLeftColor: "secondary.main",
            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.08),
          }}
        >
          <AvatarListing
            listing={activeListing}
            size={28}
            variant="selected"
            linked={isLinkedListing(activeListing.id)}
          />
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              minWidth: 0,
              overflowWrap: "anywhere",
              lineHeight: 1.25,
              fontWeight: 700,
              color: "secondary.main",
            }}
          >
            {activeListing.name ?? activeListing.label ?? "Liste"}
          </Typography>

          <Tooltip title={moreS} arrow placement="top">
            <Box
              component="button"
              onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
              sx={{
                ...bandButtonSx,
                bgcolor: moreMenuAnchor ? "action.selected" : "action.hover",
              }}
            >
              <MoreHoriz sx={{ fontSize: 18 }} />
            </Box>
          </Tooltip>

          {/* Annotations count pill = listing visibility toggle (light
              transposition of the top bar base map badge). */}
          <ButtonCountPill
            count={activeCount}
            hidden={activeHidden}
            title={activeHidden ? showListingS : hideListingS}
            onClick={() => toggleVisibility(activeListing.id)}
          />
        </Box>
      )}

      <MenuMoreActionsActiveListing
        anchorEl={moreMenuAnchor}
        onClose={() => setMoreMenuAnchor(null)}
        listing={activeListing}
      />

      {openCreateListing && (
        <DialogChooseListingSource
          open={openCreateListing}
          onClose={() => setOpenCreateListing(false)}
        />
      )}
    </Box>
  );
}
