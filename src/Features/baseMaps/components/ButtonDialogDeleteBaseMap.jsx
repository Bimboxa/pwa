import { useState } from "react";

import { useDispatch } from "react-redux";

import { ListItemButton, Typography } from "@mui/material";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import { setSelectedBaseMapId } from "Features/baseMaps/baseMapsSlice";

import db, { withSystemWrite } from "App/db/db";
import { OwnershipError } from "App/db/ownership";
import useCanEditRecord from "App/hooks/useCanEditRecord";

export default function ButtonDialogDeleteBaseMap({ baseMap }) {
  const dispatch = useDispatch();

  // permissions

  const { guardEditRecord } = useCanEditRecord();

  // strings

  const deleteS = "Supprimer le fond de plan";

  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleClick() {
    if (!guardEditRecord(baseMap)) return;
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  async function confirmDelete() {
    setOpen(false);
    if (!guardEditRecord(baseMap)) return;
    try {
      // The base-map owner controls its versions: delete the base map
      // first (guarded), then cascade-delete versions bypassing their
      // own ownership.
      await db.baseMaps.delete(baseMap.id);
      await withSystemWrite(() =>
        db.baseMapVersions.where("baseMapId").equals(baseMap.id).delete()
      );
      dispatch(setSelectedBaseMapId(null));
    } catch (error) {
      if (!(error instanceof OwnershipError)) throw error;
    }
  }
  // render

  return (
    <>
      <ListItemButton onClick={handleClick}>
        <Typography variant="body2" color="text.secondary">
          {deleteS}
        </Typography>
      </ListItemButton>

      <DialogDeleteRessource
        open={open}
        onClose={handleClose}
        onConfirmAsync={confirmDelete}
      />
    </>
  );
}
