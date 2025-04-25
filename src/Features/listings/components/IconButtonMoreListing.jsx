import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setOpenListingSyncDetail} from "../listingsSlice";

import useDeleteListing from "../hooks/useDeleteListing";
import useUpdateListing from "../hooks/useUpdateListing";

import {Box} from "@mui/material";
import {MoreHoriz} from "@mui/icons-material";

import IconButtonMenu from "Features/layout/components/IconButtonMenu";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import DialogListingSyncDetail from "./DialogListingSyncDetail";
import {triggerEntitiesUpdate} from "Features/entities/entitiesSlice";
import DialogGenericRename from "Features/layout/components/DialogGenericRename";
import useSelectedListing from "../hooks/useSelectedListing";
import {update} from "firebase/database";

export default function IconButtonMoreListing() {
  const dispatch = useDispatch();

  // state

  const [openDelete, setOpenDelete] = useState(false);
  const [openRename, setOpenRename] = useState(false);

  // data

  const listingId = useSelector((s) => s.listings.selectedListingId);
  const openSync = useSelector((s) => s.listings.openListingSyncDetail);
  const {value: listing} = useSelectedListing();

  // data - func

  const updateListing = useUpdateListing();
  const deleteListing = useDeleteListing();

  // helpers - handler

  function handleOpenSync() {
    dispatch(setOpenListingSyncDetail(true));
  }
  function handleCloseSync() {
    dispatch(setOpenListingSyncDetail(false));
  }
  function handleRefresh() {
    dispatch(triggerEntitiesUpdate());
  }
  async function handleRename(newName) {
    console.log("[IconButtonMoreListing] handleRename", newName);
    await updateListing(
      {
        id: listing.id,
        name: newName,
      },
      {updateSyncFile: true}
    );
  }

  // actions

  const actions = [
    {
      label: "Renommer",
      handler: () => setOpenRename(true),
    },
    {
      label: "Synchroniser",
      handler: handleOpenSync,
    },
    {
      label: "Mettre à jour",
      handler: handleRefresh,
    },
    {
      label: "Sync",
      handler: handleOpenSync,
    },
    {
      label: "Supprimer",
      handler: () => setOpenDelete(true),
    },
  ];

  return (
    <Box>
      <IconButtonMenu actions={actions} icon={<MoreHoriz />} />

      <DialogListingSyncDetail open={openSync} onClose={handleCloseSync} />

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={() => deleteListing(listingId)}
      />

      <DialogGenericRename
        open={openRename}
        onClose={() => setOpenRename(false)}
        name={listing?.name}
        onNameChange={handleRename}
      />
    </Box>
  );
}
