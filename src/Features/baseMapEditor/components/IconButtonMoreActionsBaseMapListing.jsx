import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";

import { IconButton, Menu, MenuItem } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import useDeleteBaseMapListing, {
  countBaseMapListingContent,
} from "../hooks/useDeleteBaseMapListing";
import useCanEditRecord from "App/hooks/useCanEditRecord";
import { OwnershipError } from "App/db/ownership";

export default function IconButtonMoreActionsBaseMapListing({
  listing,
  ...iconButtonProps
}) {
  const dispatch = useDispatch();

  // strings

  const deleteS = "Supprimer";

  // data

  const deleteBaseMapListing = useDeleteBaseMapListing();
  const { canEditRecord, guardEditRecord } = useCanEditRecord();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [content, setContent] = useState({
    baseMapsCount: 0,
    annotationsCount: 0,
  });

  // helpers

  const deleteMessage =
    content.baseMapsCount > 0
      ? `${content.baseMapsCount} fond(s) de plan et ${content.annotationsCount} annotation(s) seront également supprimés.`
      : undefined;

  // handlers

  function handleClick(event) {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleDelete() {
    setAnchorEl(null);
    if (!guardEditRecord(listing)) return;
    setContent(await countBaseMapListingContent(listing.id));
    setOpenDelete(true);
  }

  async function handleConfirmDelete() {
    try {
      await deleteBaseMapListing(listing);
    } catch (error) {
      if (!(error instanceof OwnershipError)) throw error;
      setOpenDelete(false);
      return;
    }
    // The listing record is gone: clearing the selection prevents the
    // properties panel from targeting a deleted group.
    dispatch(setSelectedItem({}));
    setOpenDelete(false);
  }

  // render

  return (
    <>
      <IconButton onClick={handleClick} {...iconButtonProps}>
        <MoreActionsIcon />
      </IconButton>

      <Menu open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem onClick={handleDelete} disabled={!canEditRecord(listing)}>
          {deleteS}
        </MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={handleConfirmDelete}
        message={deleteMessage}
      />
    </>
  );
}
