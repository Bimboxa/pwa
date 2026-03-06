import { useState } from "react";

import { useDispatch } from "react-redux";

import useDeleteListing from "../hooks/useDeleteListing";
import useCreateListings from "../hooks/useCreateListings";

import { setSelectedListingId } from "../listingsSlice";

import { IconButton, Menu, MenuItem, Divider } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function IconButtonMoreActionsListing({ listing }) {
  const dispatch = useDispatch();

  // data

  const deleteListing = useDeleteListing();
  const createListings = useCreateListings();

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
        <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={async () => {
          await deleteListing(listing.id);
          setOpenDelete(false);
        }}
      />
    </>
  );
}
