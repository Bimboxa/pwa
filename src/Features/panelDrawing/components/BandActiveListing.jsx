import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";
import {
  setAutoListingVisibility,
  setViewerAnnotationsScope,
} from "Features/panelDrawing/panelDrawingSlice";
import { setListingsPanelExpanded } from "Features/popperMapListings/popperMapListingsSlice";

import {
  Box,
  Checkbox,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Add from "@mui/icons-material/Add";
import MoreHoriz from "@mui/icons-material/MoreHoriz";

import AvatarListing from "Features/listings/components/AvatarListing";
import DialogChooseListingSource from "Features/listings/components/DialogChooseListingSource";
import useLinkedListings from "Features/listings/hooks/useLinkedListings";
import SectionPopperListings from "Features/popperMapListings/components/SectionPopperListings";
import MenuMoreActionsActiveListing from "./MenuMoreActionsActiveListing";

import bandButtonSx from "Features/popperMapListings/utils/bandButtonSx";

// ---------------------------------------------------------------------------
// BandActiveListing — active listing block of the Dessin popper and of the
// docked Dessin panel (PanelDrawing), right under the header and above the
// templates of the active listing:
// 1. the "Listes d'annotations" header: a "+" (new listing), a "..." options
//    menu ("Visibilité auto", quantities scope) and the
//    expand / collapse button of the listings panel (SectionPopperListings:
//    select, show / hide, reorder, create), shown between the header and
//    the band — expanded by default;
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
  const listingsOptionsS = "Options des listes";
  const autoVisibilityS = "Visibilité auto";
  const autoVisibilityTooltipS =
    "Au changement de liste : masque les autres listes et affiche tous les modèles de la liste sélectionnée.";
  const baseMapOnlyS = "Quantités pour le fond de plan sélectionné seul";
  const baseMapOnlyTooltipS =
    "Si activé, les quantités affichées sont celles du fond de plan sélectionné uniquement. Sinon, celles de toutes les annotations (tous les fonds de plan).";
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
  const autoVisibility = useSelector(
    (s) => s.panelDrawing.autoListingVisibility
  );
  const annotationsScope = useSelector(
    (s) => s.panelDrawing.viewerAnnotationsScope
  );
  const baseMapOnly = annotationsScope === "BASE_MAP";

  const { isLinkedListing } = useLinkedListings();

  // state

  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState(null);
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

  const handleToggleAutoVisibility = () => {
    dispatch(setAutoListingVisibility(!autoVisibility));
  };

  const handleToggleBaseMapOnly = () => {
    dispatch(setViewerAnnotationsScope(baseMapOnly ? "ALL" : "BASE_MAP"));
  };

  // render

  return (
    <Box>
      {/* "Listes" header: title, then the "..." options menu ("Visibilité
          auto") and the expand / collapse button of the listings panel. */}
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

        <Tooltip title={listingsOptionsS} arrow placement="top">
          <Box
            component="button"
            onClick={(e) => {
              e.stopPropagation();
              setOptionsMenuAnchor(e.currentTarget);
            }}
            sx={{
              ...bandButtonSx,
              bgcolor: optionsMenuAnchor ? "action.selected" : "action.hover",
            }}
          >
            <MoreHoriz sx={{ fontSize: 18 }} />
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

      {/* Options menu of the listings: "Visibilité auto" (selecting a
          listing hides every other listing and unhides all the templates
          of the selected one — panelDrawing.autoListingVisibility) and the
          quantities scope switch. */}
      <Menu
        anchorEl={optionsMenuAnchor}
        open={Boolean(optionsMenuAnchor)}
        onClose={() => setOptionsMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        <Tooltip
          title={autoVisibilityTooltipS}
          arrow
          placement="left"
          enterDelay={400}
        >
          <MenuItem dense onClick={handleToggleAutoVisibility}>
            <Checkbox
              size="small"
              color="secondary"
              checked={Boolean(autoVisibility)}
              disableRipple
              sx={{ p: 0, mr: 1 }}
            />
            <ListItemText
              primary={autoVisibilityS}
              slotProps={{ primary: { variant: "body2" } }}
            />
          </MenuItem>
        </Tooltip>

        {/* Quantities scope: the selected base map only, or every
            annotation of the repérage (panelDrawing.viewerAnnotationsScope,
            same state as the "Fond de plan / Tous" chips of the Viewer
            panels). */}
        <Tooltip
          title={baseMapOnlyTooltipS}
          arrow
          placement="left"
          enterDelay={400}
        >
          <MenuItem dense onClick={handleToggleBaseMapOnly}>
            <Switch
              size="small"
              color="secondary"
              checked={baseMapOnly}
              disableRipple
              sx={{ transform: "scale(0.8)", m: -0.5, mr: 0.5 }}
            />
            <ListItemText
              primary={baseMapOnlyS}
              slotProps={{ primary: { variant: "body2" } }}
            />
          </MenuItem>
        </Tooltip>
      </Menu>

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
          <Tooltip
            title={activeHidden ? showListingS : hideListingS}
            arrow
            placement="top"
          >
            <Box
              component="button"
              onClick={() => toggleVisibility(activeListing.id)}
              sx={{
                minWidth: 24,
                height: 20,
                px: 0.75,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                borderRadius: 999,
                border: "1px solid",
                borderColor: activeHidden ? "panel.border" : "transparent",
                bgcolor: activeHidden ? "transparent" : "secondary.main",
                color: activeHidden
                  ? "text.disabled"
                  : "secondary.contrastText",
                cursor: "pointer",
                transition: "0.2s",
                "&:hover": {
                  filter: "brightness(1.1)",
                  borderColor: activeHidden ? "text.secondary" : "transparent",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  fontFamily: "monospace",
                  lineHeight: 1,
                  color: "inherit",
                }}
              >
                {activeCount}
              </Typography>
            </Box>
          </Tooltip>
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
