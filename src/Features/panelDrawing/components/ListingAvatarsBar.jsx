import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";

import { Box, Tooltip, Typography } from "@mui/material";
import Add from "@mui/icons-material/Add";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import AvatarListing from "Features/listings/components/AvatarListing";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import MenuMoreActionsActiveListing from "./MenuMoreActionsActiveListing";

import useSelectActiveListing from "Features/panelDrawing/hooks/useSelectActiveListing";

// ---------------------------------------------------------------------------
// ListingAvatarsBar — compact alternative to the LISTE ACTIVE field: one
// avatar per listing (selected in intense secondary, visible listings with
// annotations on the current base map in light secondary, hidden or empty
// listings in grey), a "+" avatar to create a listing and, at the far right,
// the "..." menu of the active listing (which hosts the Sélecteur / Avatars
// mode switch).
// Click = select the listing (unhides it, the other listings are untouched),
// double click = select the listing and hide all the others.
// Hover = two indicators above the avatar: a visibility toggle (left) and
// the annotations count (right, "+99" above 99), plus a bottom tooltip with
// the listing name.
// ---------------------------------------------------------------------------

const MAX_BADGE_COUNT = 99;
const INDICATOR_SIZE = 16;
const AVATAR_SIZE = 32;

export default function ListingAvatarsBar({
  listings,
  activeListing,
  countsByListingId,
  showAddListing = true,
}) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Liste active";
  const addListingS = "Nouvelle liste";
  const moreS = "Actions sur la liste active";

  // data

  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  const selectListing = useSelectActiveListing(listings);

  // state

  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [openCreateListing, setOpenCreateListing] = useState(false);

  // helpers

  const activeListingId = activeListing?.id;

  const getVariant = (listing, count, hidden) => {
    if (listing.id === activeListingId) return "selected";
    if (hidden || count === 0) return "muted";
    return "visible";
  };

  const getBadgeContent = (count) =>
    count > MAX_BADGE_COUNT ? `+${MAX_BADGE_COUNT}` : count;

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

  // The two clicks of a double click also run handleClick: harmless, it
  // only selects / unhides the same listing.
  const handleClick = (listingId) => {
    selectListing(listingId, { hideOthers: false });
  };

  const handleDoubleClick = (listingId) => {
    selectListing(listingId, { hideOthers: true });
  };

  const handleToggleVisibility = (e, listingId) => {
    e.stopPropagation();
    toggleVisibility(listingId);
  };

  // render

  return (
    <Box>
      <Box sx={{ px: 2, pt: 1, pb: 1.5 }}>
        {/* Title row: "LISTE ACTIVE" label + "..." menu of the active listing */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: "0.65rem",
            }}
          >
            {labelS}
          </Typography>

          {activeListing && (
            <Tooltip title={moreS} arrow placement="top">
              <Box
                component="button"
                onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  p: 0,
                  border: "none",
                  borderRadius: 2,
                  flexShrink: 0,
                  cursor: "pointer",
                  color: "text.secondary",
                  bgcolor: moreMenuAnchor ? "action.selected" : "action.hover",
                  "&:hover": { bgcolor: "action.selected" },
                }}
              >
                <MoreHoriz sx={{ fontSize: 18 }} />
              </Box>
            </Tooltip>
          )}
        </Box>

        {/* Avatars row */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1.75,
            px: 0.5,
          }}
        >
          {listings?.map((listing) => {
            const count = countsByListingId?.[listing.id] ?? 0;
            const hidden = hiddenListingsIds.includes(listing.id);
            const variant = getVariant(listing, count, hidden);
            return (
              <Box
                key={listing.id}
                sx={{
                  position: "relative",
                  display: "inline-flex",
                  "& .listingAvatarIndicator": {
                    opacity: 0,
                    transition: "opacity 120ms",
                  },
                  "&:hover .listingAvatarIndicator": { opacity: 1 },
                }}
              >
                <Tooltip
                  title={listing.name ?? listing.label ?? "Liste"}
                  arrow
                  placement="bottom"
                >
                  <AvatarListing
                    listing={listing}
                    size={AVATAR_SIZE}
                    variant={variant}
                    onClick={() => handleClick(listing.id)}
                    onDoubleClick={() => handleDoubleClick(listing.id)}
                  />
                </Tooltip>

                {/* Hover indicator (top left): visibility toggle */}
                <Box
                  component="button"
                  className="listingAvatarIndicator"
                  onClick={(e) => handleToggleVisibility(e, listing.id)}
                  onDoubleClick={(e) => e.stopPropagation()}
                  sx={{
                    position: "absolute",
                    top: -INDICATOR_SIZE / 2,
                    left: -INDICATOR_SIZE / 2,
                    width: INDICATOR_SIZE + 2,
                    height: INDICATOR_SIZE + 2,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 0,
                    borderRadius: "50%",
                    border: "1.5px solid",
                    borderColor: "background.paper",
                    bgcolor: hidden ? "panel.iconMuted" : "secondary.main",
                    color: "secondary.contrastText",
                    cursor: "pointer",
                    zIndex: 1,
                  }}
                >
                  {hidden ? (
                    <VisibilityOff sx={{ fontSize: 11 }} />
                  ) : (
                    <Visibility sx={{ fontSize: 11 }} />
                  )}
                </Box>

                {/* Hover indicator (top right): annotations count */}
                <Box
                  className="listingAvatarIndicator"
                  sx={{
                    position: "absolute",
                    top: -INDICATOR_SIZE / 2,
                    right: -INDICATOR_SIZE / 2,
                    height: INDICATOR_SIZE + 2,
                    minWidth: INDICATOR_SIZE + 2,
                    px: 0.5,
                    boxSizing: "border-box",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    border: "1.5px solid",
                    borderColor: "background.paper",
                    bgcolor: hidden ? "panel.iconMuted" : "secondary.main",
                    color: "secondary.contrastText",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    lineHeight: 1,
                    zIndex: 1,
                    // Display only: clicks go through to the avatar.
                    pointerEvents: "none",
                  }}
                >
                  {getBadgeContent(count)}
                </Box>
              </Box>
            );
          })}

          {showAddListing && (
            <Tooltip title={addListingS} arrow placement="top">
              <Box
                component="button"
                onClick={() => setOpenCreateListing(true)}
                sx={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 0,
                  borderRadius: "50%",
                  border: "1px dashed",
                  borderColor: "panel.textLight",
                  bgcolor: "transparent",
                  color: "panel.textMuted",
                  cursor: "pointer",
                  flexShrink: 0,
                  "&:hover": {
                    borderColor: "secondary.main",
                    color: "secondary.main",
                  },
                }}
              >
                <Add sx={{ fontSize: 18 }} />
              </Box>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Full name of the active listing, right above its templates — same
          section band as "Outils de dessin" below. */}
      {activeListing && (
        <Box
          sx={{
            px: 1,
            py: 0.5,
            bgcolor: "panel.sectionBg",
            borderTop: "1px solid",
            borderColor: "panel.border",
          }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{
              display: "block",
              color: "panel.textMuted",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontSize: "11px",
            }}
          >
            {activeListing.name ?? activeListing.label ?? "Liste"}
          </Typography>
        </Box>
      )}

      <MenuMoreActionsActiveListing
        anchorEl={moreMenuAnchor}
        onClose={() => setMoreMenuAnchor(null)}
        listing={activeListing}
        showModeSwitch
      />

      {openCreateListing && (
        <DialogCreateListing
          open={openCreateListing}
          onClose={() => setOpenCreateListing(false)}
          isForBaseMaps={false}
        />
      )}
    </Box>
  );
}
