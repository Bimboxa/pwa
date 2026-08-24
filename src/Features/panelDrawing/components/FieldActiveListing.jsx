import { useState } from "react";
import { useDispatch } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";

import {
  Box,
  Button,
  Typography,
  InputBase,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import Check from "@mui/icons-material/Check";
import Add from "@mui/icons-material/Add";

import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import MenuMoreActionsActiveListing from "./MenuMoreActionsActiveListing";
import useUpdateListing from "Features/listings/hooks/useUpdateListing";

// ---------------------------------------------------------------------------
// FieldActiveListing — "LISTE ACTIVE" select-style field of the Dessin panel.
// Opens the menu of the scope's listings; the trailing item creates a new one.
// With no listing at all, the field becomes the create CTA.
// ---------------------------------------------------------------------------

export default function FieldActiveListing({ listings, activeListing }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Liste active";
  const addListingS = "Nouvelle liste";
  const createListingS = "Créer une liste";

  // data

  const updateListing = useUpdateListing();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [openCreateListing, setOpenCreateListing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState("");

  // helpers

  const hasNoListing = !listings?.length;
  // The system listing ("Générique") is auto-provisioned — no rename /
  // delete / duplicate on it.
  const showMoreButton =
    activeListing && !activeListing.isFreeAnnotationsListing;

  // handlers

  const handleSelectListing = (listingId) => {
    dispatch(setSelectedListingId(listingId));
    setMenuAnchor(null);
  };

  const handleAddListing = () => {
    setMenuAnchor(null);
    setOpenCreateListing(true);
  };

  const handleFieldClick = (e) => {
    if (isRenaming) return;
    setMenuAnchor(e.currentTarget);
  };

  const handleMoreClick = (e) => {
    e.stopPropagation();
    setMoreMenuAnchor(e.currentTarget);
  };

  const handleStartRename = () => {
    setTempName(activeListing?.name ?? "");
    setIsRenaming(true);
  };

  const handleConfirmRename = async () => {
    setIsRenaming(false);
    const name = tempName.trim();
    if (!name || name === activeListing?.name) return;
    await updateListing({ ...activeListing, name }, { updateSyncFile: true });
  };

  // render

  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      {hasNoListing ? (
        <Button
          fullWidth
          variant="contained"
          color="secondary"
          onClick={() => setOpenCreateListing(true)}
        >
          {createListingS}
        </Button>
      ) : (
        <Box
          component="button"
          onClick={handleFieldClick}
          sx={{
            width: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
            textAlign: "left",
            px: 2,
            py: 1,
            cursor: isRenaming ? "default" : "pointer",
            fontFamily: "inherit",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            "&:hover": { borderColor: "text.secondary" },
            "&:hover .field-more-btn": { opacity: 1 },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontSize: "0.65rem",
              }}
            >
              {labelS}
            </Typography>
            {isRenaming ? (
              <InputBase
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") handleConfirmRename();
                  else if (e.key === "Escape") setIsRenaming(false);
                }}
                onBlur={handleConfirmRename}
                autoFocus
                fullWidth
                sx={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  lineHeight: 1.3,
                  p: 0,
                  "& input": { p: 0 },
                }}
              />
            ) : (
              <Typography
                variant="subtitle1"
                noWrap
                sx={{ fontWeight: 700, lineHeight: 1.3 }}
              >
                {activeListing?.name ?? activeListing?.label ?? "Liste"}
              </Typography>
            )}
          </Box>
          {/* Not an IconButton: the field itself is a <button>, nesting one
              would be invalid HTML. */}
          {showMoreButton && !isRenaming && (
            <Box
              component="span"
              className="field-more-btn"
              onClick={handleMoreClick}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 2,
                flexShrink: 0,
                color: "text.secondary",
                bgcolor: moreMenuAnchor ? "action.selected" : "action.hover",
                opacity: moreMenuAnchor ? 1 : 0,
                transition: "opacity 0.15s",
                "&:hover": { bgcolor: "action.selected" },
              }}
            >
              <MoreHoriz sx={{ fontSize: 18 }} />
            </Box>
          )}
          <ExpandMore sx={{ color: "text.secondary", flexShrink: 0 }} />
        </Box>
      )}

      <MenuMoreActionsActiveListing
        anchorEl={moreMenuAnchor}
        onClose={() => setMoreMenuAnchor(null)}
        listing={activeListing}
        onRename={handleStartRename}
      />

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              minWidth: menuAnchor?.offsetWidth ?? 240,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        {listings?.map((listing) => {
          const selected = listing.id === activeListing?.id;
          return (
            <MenuItem
              key={listing.id}
              selected={selected}
              onClick={() => handleSelectListing(listing.id)}
              sx={{ gap: 1, py: 0.75 }}
            >
              <ListItemText
                primaryTypographyProps={{
                  variant: "body2",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {listing.name ?? listing.label ?? "Liste"}
              </ListItemText>
              {selected && <Check sx={{ fontSize: 16, ml: "auto" }} />}
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem onClick={handleAddListing} sx={{ gap: 1, py: 0.75 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <Add sx={{ fontSize: 18, color: "panel.textMuted" }} />
          </ListItemIcon>
          <ListItemText
            primaryTypographyProps={{
              variant: "body2",
              color: "panel.textMuted",
            }}
          >
            {addListingS}
          </ListItemText>
        </MenuItem>
      </Menu>

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
