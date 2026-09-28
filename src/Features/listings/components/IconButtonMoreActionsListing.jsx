import { useState } from "react";

import { useDispatch } from "react-redux";

import useDeleteListing from "../hooks/useDeleteListing";
import useCreateListings from "../hooks/useCreateListings";

import { setSelectedListingId } from "../listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { IconButton, Menu, MenuItem, Divider } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import DialogRenameListing from "./DialogRenameListing";

import { OwnershipError } from "App/db/ownership";
import useCanEditRecord from "App/hooks/useCanEditRecord";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useLinkedListings from "../hooks/useLinkedListings";
import useUnlinkListingFromScope from "../hooks/useUnlinkListingFromScope";

export default function IconButtonMoreActionsListing({ listing, size }) {
  const dispatch = useDispatch();

  // data

  const deleteListing = useDeleteListing();
  const createListings = useCreateListings();
  const { canEditRecord, guardEditRecord } = useCanEditRecord();
  // Listing linked from another scope ("Depuis un autre Krto"): the only
  // action is unlinking it from this scope.
  const appConfig = useAppConfig();
  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "plan de repérage";
  const { isLinkedListing } = useLinkedListings();
  const unlinkListing = useUnlinkListingFromScope();
  const linked = isLinkedListing(listing?.id);
  const unlinkS = `Retirer du ${scopeS}`;

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);
  const [openRename, setOpenRename] = useState(false);

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

  const handleRename = () => {
    setAnchorEl(null);
    if (!guardEditRecord(listing)) return;
    setOpenRename(true);
  };

  const handleDelete = () => {
    setAnchorEl(null);
    if (!guardEditRecord(listing)) return;
    setOpenDelete(true);
  };

  const handleUnlink = async () => {
    setAnchorEl(null);
    await unlinkListing(listing?.id);
  };

  return (
    <>
      <IconButton onClick={handleClick} size={size}>
        <MoreActionsIcon fontSize={size === "small" ? "small" : undefined} />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        {linked ? (
          <MenuItem onClick={handleUnlink}>{unlinkS}</MenuItem>
        ) : (
          [
            <MenuItem
              key="rename"
              onClick={handleRename}
              disabled={!canEditRecord(listing)}
            >
              Renommer
            </MenuItem>,
            <MenuItem key="duplicate" onClick={handleDuplicate}>
              Dupliquer
            </MenuItem>,
            <Divider key="divider" />,
            <MenuItem
              key="delete"
              onClick={handleDelete}
              disabled={!canEditRecord(listing)}
            >
              Supprimer
            </MenuItem>,
          ]
        )}
      </Menu>

      {openRename && (
        <DialogRenameListing
          open
          listing={listing}
          onClose={() => setOpenRename(false)}
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
