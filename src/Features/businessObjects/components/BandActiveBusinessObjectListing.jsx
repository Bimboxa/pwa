import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setListingsPanelExpanded } from "../businessObjectsSlice";

import { Box, Tooltip, Typography } from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Add from "@mui/icons-material/Add";
import MoreHoriz from "@mui/icons-material/MoreHoriz";

import AvatarListing from "Features/listings/components/AvatarListing";
import ButtonCountPill from "Features/popperMapListings/components/ButtonCountPill";
import DialogCreateBusinessObjectListing from "./DialogCreateBusinessObjectListing";
import MenuMoreActionsBusinessObjectListing from "./MenuMoreActionsBusinessObjectListing";
import SectionBusinessObjectListings from "./SectionBusinessObjectListings";

import useBusinessObjectType from "../hooks/useBusinessObjectType";

import bandButtonSx from "Features/popperMapListings/utils/bandButtonSx";
import activeListingCardSx from "Features/popperMapListings/utils/activeListingCardSx";

// ---------------------------------------------------------------------------
// BandActiveBusinessObjectListing — active listing block of a business-
// objects module, in its left panel (PanelBusinessObjects) and in the
// "Objets" side of the popper (SectionPopperBusinessObjects), right under
// the header and above the objects card of the active listing. Transposition
// of the Dessin BandActiveListing:
// 1. the "Listes d'ouvrages" (type wording) header: a "+" (new listing) and
//    the expand / collapse button of the listings panel
//    (SectionBusinessObjectListings: select, reorder, "...", create) —
//    expanded by default;
// 2. the active listing band (white accent card, same as the selected row
//    and as the objects card below): the listing avatar, its full name, the
//    "..." menu and the objects count pill.
// The expanded state lives in redux (businessObjects.listingsPanelExpanded)
// so it is shared by both hosts and survives the popper remount between the
// 2D and 3D editors.
// ---------------------------------------------------------------------------

// The panel lives in the non-scrollable block of the host, above the objects
// card: capped so a long list never pushes the objects out of sight.
const PANEL_MAX_HEIGHT = 240;

export default function BandActiveBusinessObjectListing({
  typeKey,
  listings,
  activeListing,
  countsByListingId,
}) {
  const dispatch = useDispatch();

  // data — type of the module (the module IS the type): header wording,
  // resolved for the org (appConfig strings.businessObjectTypes)

  const moduleType = useBusinessObjectType(typeKey ?? undefined);

  // strings

  const listingsS = moduleType.strings.listings ?? "Listes";
  const expandS = "Déplier les listes";
  const collapseS = "Replier les listes";
  const addListingS = "Nouvelle liste";
  const moreS = "Actions sur la liste active";

  // data

  const expanded = useSelector((s) => s.businessObjects.listingsPanelExpanded);

  // state

  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [openCreateListing, setOpenCreateListing] = useState(false);

  // helpers

  const accent = "secondary.main";
  const activeCount = activeListing
    ? (countsByListingId?.[activeListing.id] ?? 0)
    : 0;

  // handlers

  const handleToggleExpanded = () => {
    dispatch(setListingsPanelExpanded(!expanded));
  };

  // render

  return (
    // Grey block on both hosts: with the listings panel collapsed, the
    // active band card sits on it, right above the objects card.
    <Box sx={{ bgcolor: "background.default" }}>
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
            bgcolor: "background.default",
          }}
        >
          <SectionBusinessObjectListings
            typeKey={typeKey}
            listings={listings}
            activeListing={activeListing}
            countsByListingId={countsByListingId}
          />
        </Box>
      )}

      {/* Active listing band: the same white accent card as the selected
          row of the expanded panel (it stacks right above the objects card
          of the listing). Hidden while the listings panel is expanded: its
          selected row already shows the same. */}
      {activeListing && !expanded && (
        /* Padding on a wrapper, not margins on the card: a bottom margin
           would collapse through the grey block. */
        <Box sx={{ p: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              pl: 1,
              pr: 2,
              py: 0.75,
              ...activeListingCardSx(accent),
            }}
          >
            <AvatarListing
              listing={activeListing}
              size={28}
              variant="selected"
            />
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                minWidth: 0,
                overflowWrap: "anywhere",
                lineHeight: 1.25,
                fontWeight: 700,
                color: accent,
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

            <ButtonCountPill count={activeCount} accent={accent} />
          </Box>
        </Box>
      )}

      <MenuMoreActionsBusinessObjectListing
        anchorEl={moreMenuAnchor}
        onClose={() => setMoreMenuAnchor(null)}
        listing={activeListing}
      />

      {openCreateListing && (
        <DialogCreateBusinessObjectListing
          open
          onClose={() => setOpenCreateListing(false)}
        />
      )}
    </Box>
  );
}
