import { useState } from "react";
import { useDispatch } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";

import {
  Box,
  Typography,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import Edit from "@mui/icons-material/Edit";
import Star from "@mui/icons-material/Star";
import StarBorder from "@mui/icons-material/StarBorder";
import ContentCopy from "@mui/icons-material/ContentCopy";
import DeleteOutline from "@mui/icons-material/DeleteOutline";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import DialogRenameListing from "Features/listings/components/DialogRenameListing";
import useDeleteListing from "Features/listings/hooks/useDeleteListing";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useFavoriteListings from "Features/listings/hooks/useFavoriteListings";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useCanEditRecord from "App/hooks/useCanEditRecord";
import { OwnershipError } from "App/db/ownership";

// ---------------------------------------------------------------------------
// MenuMoreActionsActiveListing — "..." menu of the active-listing field:
// rename (dialog), favorites toggle, duplicate, delete. Duplicate / delete
// mirror IconButtonMoreActionsListing.
// ---------------------------------------------------------------------------

export default function MenuMoreActionsActiveListing({
  anchorEl,
  onClose,
  listing,
}) {
  const dispatch = useDispatch();

  // strings

  const renameS = "Renommer";
  const addFavoriteS = "Ajouter aux favoris";
  const removeFavoriteS = "Retirer des favoris";
  const duplicateS = "Dupliquer";
  const deleteS = "Supprimer la liste";

  // data

  const deleteListing = useDeleteListing();
  const createListings = useCreateListings();
  const { canEditRecord, guardEditRecord } = useCanEditRecord();
  const { isFavorite, toggleFavorite } = useFavoriteListings();
  // Favorites store the listing WITH its templates (see useFavoriteListings).
  const annotationTemplates = useAnnotationTemplates({
    filterByListingId: listing?.id,
    sortByOrder: true,
  });

  // state

  const [openRename, setOpenRename] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // helpers

  const favorite = isFavorite(listing?.id);

  // handlers

  const handleRename = () => {
    onClose();
    setOpenRename(true);
  };

  const handleToggleFavorite = () => {
    toggleFavorite({ listing, annotationTemplates });
    onClose();
  };

  const handleDuplicate = async () => {
    onClose();
    const { id, ...listingData } = listing;
    void id;
    const newListing = {
      ...listingData,
      name: (listing.name ?? "") + " (copie)",
    };
    const created = await createListings({
      listings: [newListing],
      scope: { id: listing.scopeId, projectId: listing.projectId },
    });
    if (created?.[0]?.id) {
      dispatch(setSelectedListingId(created[0].id));
    }
  };

  const handleDelete = () => {
    onClose();
    if (!guardEditRecord(listing)) return;
    setOpenDelete(true);
  };

  // render

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
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
        {/* Listing name header */}
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "panel.border",
          }}
        >
          <Typography
            variant="body2"
            noWrap
            sx={{ fontWeight: 600, color: "panel.textMuted" }}
          >
            {listing?.name ?? listing?.label ?? "Liste"}
          </Typography>
        </Box>

        <MenuItem onClick={handleRename} sx={{ gap: 1, py: 0.75 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <Edit sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: "body2" }}>
            {renameS}
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={handleToggleFavorite} sx={{ gap: 1, py: 0.75 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            {favorite ? (
              <Star sx={{ fontSize: 18, color: "warning.main" }} />
            ) : (
              <StarBorder sx={{ fontSize: 18 }} />
            )}
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: "body2" }}>
            {favorite ? removeFavoriteS : addFavoriteS}
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={handleDuplicate} sx={{ gap: 1, py: 0.75 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <ContentCopy sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: "body2" }}>
            {duplicateS}
          </ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={handleDelete}
          disabled={!canEditRecord(listing)}
          sx={{ gap: 1, py: 0.75, color: "error.main" }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <DeleteOutline sx={{ fontSize: 18, color: "error.main" }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: "body2" }}>
            {deleteS}
          </ListItemText>
        </MenuItem>
      </Menu>

      {openRename && (
        <DialogRenameListing
          open={openRename}
          onClose={() => setOpenRename(false)}
          listing={listing}
        />
      )}

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={async () => {
          try {
            await deleteListing(listing.id);
          } catch (error) {
            if (!(error instanceof OwnershipError)) throw error;
          }
          setOpenDelete(false);
        }}
      />
    </>
  );
}
