import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";

import { Badge, Box, Tooltip, Typography } from "@mui/material";
import Add from "@mui/icons-material/Add";
import MoreHoriz from "@mui/icons-material/MoreHoriz";

import AvatarListing from "Features/listings/components/AvatarListing";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import MenuMoreActionsActiveListing from "./MenuMoreActionsActiveListing";

import useSelectActiveListing from "Features/panelDrawing/hooks/useSelectActiveListing";

// ---------------------------------------------------------------------------
// ListingAvatarsBar — compact alternative to the LISTE ACTIVE field: one
// avatar per listing (selected in intense secondary, visible listings with
// annotations on the current base map in light secondary, hidden or empty
// listings in grey), a badge with the annotations count ("+99" above 99),
// a "+" avatar to create a listing and, at the far right, the "..." menu of
// the active listing (which hosts the Sélecteur / Avatars mode switch).
// Click = toggle the listing visibility, double click = select the listing.
// ---------------------------------------------------------------------------

// Single clicks are deferred so that a double click does not also toggle
// the visibility twice before selecting.
const DOUBLE_CLICK_DELAY_MS = 220;
const MAX_BADGE_COUNT = 99;
const AVATAR_SIZE = 32;

export default function ListingAvatarsBar({
  listings,
  activeListing,
  countsByListingId,
  showAddListing = true,
}) {
  const dispatch = useDispatch();

  // strings

  const hiddenS = "masquée";
  const annotationS = "annotation";
  const annotationsS = "annotations";
  const helpS = "Clic : afficher / masquer · Double clic : sélectionner";
  const labelS = "Liste active";
  const addListingS = "Nouvelle liste";
  const moreS = "Actions sur la liste active";

  // data

  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  const selectListing = useSelectActiveListing(listings);

  // state

  const clickTimerRef = useRef(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [openCreateListing, setOpenCreateListing] = useState(false);

  useEffect(() => {
    return () => clearTimeout(clickTimerRef.current);
  }, []);

  // helpers

  const activeListingId = activeListing?.id;

  const getVariant = (listing, count, hidden) => {
    if (listing.id === activeListingId) return "selected";
    if (hidden || count === 0) return "muted";
    return "visible";
  };

  const getTooltip = (listing, count, hidden) => {
    const name = listing.name ?? listing.label ?? "Liste";
    const countS = `${count} ${count > 1 ? annotationsS : annotationS}`;
    const stateS = hidden
      ? `${name} · ${countS} · ${hiddenS}`
      : `${name} · ${countS}`;
    return (
      <Box>
        <Box>{stateS}</Box>
        <Box sx={{ opacity: 0.7, fontSize: "0.7rem" }}>{helpS}</Box>
      </Box>
    );
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

  const handleClick = (listingId) => {
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      toggleVisibility(listingId);
    }, DOUBLE_CLICK_DELAY_MS);
  };

  const handleDoubleClick = (listingId) => {
    clearTimeout(clickTimerRef.current);
    selectListing(listingId);
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
              <Tooltip
                key={listing.id}
                title={getTooltip(listing, count, hidden)}
                arrow
                placement="top"
              >
                <Badge
                  badgeContent={getBadgeContent(count)}
                  invisible={count === 0}
                  overlap="circular"
                  max={MAX_BADGE_COUNT + 1}
                  sx={{
                    "& .MuiBadge-badge": {
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      height: 16,
                      minWidth: 16,
                      px: 0.5,
                      bgcolor: hidden ? "panel.iconMuted" : "secondary.main",
                      color: "secondary.contrastText",
                      border: "1.5px solid",
                      borderColor: "background.paper",
                    },
                  }}
                >
                  <AvatarListing
                    listing={listing}
                    size={AVATAR_SIZE}
                    variant={variant}
                    onClick={() => handleClick(listing.id)}
                    onDoubleClick={() => handleDoubleClick(listing.id)}
                  />
                </Badge>
              </Tooltip>
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
