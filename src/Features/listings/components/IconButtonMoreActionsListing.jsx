import { useState } from "react";

import { useDispatch } from "react-redux";

import useDeleteListing from "../hooks/useDeleteListing";
import useCreateListings from "../hooks/useCreateListings";

import { setSelectedListingId } from "../listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { IconButton, Menu, MenuItem, Divider } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import { OwnershipError } from "App/db/ownership";
import useCanEditRecord from "App/hooks/useCanEditRecord";

export default function IconButtonMoreActionsListing({ listing }) {
  const dispatch = useDispatch();

  // data

  const deleteListing = useDeleteListing();
  const createListings = useCreateListings();
  const { canEditRecord, guardEditRecord } = useCanEditRecord();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);

  // handlers

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDuplicate = async () => {
    const { id, ...listingData } = listing;
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
    setAnchorEl(null);
  };

  const handleDelete = () => {
    setAnchorEl(null);
    if (!guardEditRecord(listing)) return;
    setOpenDelete(true);
  };

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreActionsIcon />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem onClick={handleDuplicate}>Dupliquer</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} disabled={!canEditRecord(listing)}>
          Supprimer
        </MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={async () => {
          try {
            await deleteListing(listing.id);
          } catch (error) {
            if (!(error instanceof OwnershipError)) throw error;
            setOpenDelete(false);
            return;
          }
          dispatch(setSelectedItem(null));
          setOpenDelete(false);
        }}
      />
    </>
  );
}
