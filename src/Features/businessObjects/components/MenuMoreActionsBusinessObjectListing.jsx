import { useState } from "react";
import { useDispatch } from "react-redux";

import {
  setSelectedListingId,
  triggerBusinessObjectsUpdate,
} from "../businessObjectsSlice";

import { Menu, MenuItem, Divider } from "@mui/material";

import useDeleteBusinessObjectListing from "../hooks/useDeleteBusinessObjectListing";
import renumberBusinessObjectsService from "../services/renumberBusinessObjectsService";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";

import DialogRenameBusinessObjectListing from "./DialogRenameBusinessObjectListing";

// ---------------------------------------------------------------------------
// MenuMoreActionsBusinessObjectListing — "..." menu of a business-object
// listing (active listing band and selected row of the listings panel):
// Renuméroter (types with a `code`, not on Krnet-linked listings whose codes
// come from the remote list), Renommer, Supprimer. One menu per host section,
// anchored on the clicked button; `listing` is the listing it acts on.
// ---------------------------------------------------------------------------

export default function MenuMoreActionsBusinessObjectListing({
  anchorEl,
  onClose,
  listing,
}) {
  const dispatch = useDispatch();

  // strings

  const renumberS = "Renuméroter";
  const renameS = "Renommer";
  const deleteS = "Supprimer";

  // data

  const deleteBusinessObjectListing = useDeleteBusinessObjectListing();

  // state

  const [openRenameListing, setOpenRenameListing] = useState(false);

  // helpers

  // "Renuméroter" writes the `code` field: types without it (QUANTITY, whose
  // numbering is computed at display time) do not offer it.
  const hasCode = Boolean(
    getBusinessObjectTypeOfListing(listing).features?.code
  );

  // handlers

  const handleRename = () => {
    onClose();
    setOpenRenameListing(true);
  };

  const handleDelete = async () => {
    onClose();
    if (!listing) return;
    await deleteBusinessObjectListing(listing);
    dispatch(setSelectedListingId(null));
  };

  // writes the tree numbering (1, 1.1, 1.2...) into the objects' `code`
  const handleRenumber = async () => {
    onClose();
    if (!listing) return;
    await renumberBusinessObjectsService({ listingId: listing.id });
    dispatch(triggerBusinessObjectsUpdate());
  };

  // render

  return (
    <>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
        {hasCode && (
          <MenuItem
            onClick={handleRenumber}
            disabled={Boolean(listing?.notesApp)}
          >
            {renumberS}
          </MenuItem>
        )}
        {hasCode && <Divider />}
        <MenuItem onClick={handleRename}>{renameS}</MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          {deleteS}
        </MenuItem>
      </Menu>

      {openRenameListing && listing && (
        <DialogRenameBusinessObjectListing
          open
          listing={listing}
          onClose={() => setOpenRenameListing(false)}
        />
      )}
    </>
  );
}
