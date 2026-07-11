import { useState } from "react";

import { useDispatch } from "react-redux";

import { ListItemButton, Typography } from "@mui/material";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import { setSelectedBaseMapId } from "Features/baseMaps/baseMapsSlice";

import useDeleteBaseMap, {
  countBaseMapAnnotations,
} from "Features/baseMaps/hooks/useDeleteBaseMap";

export default function ButtonDialogDeleteBaseMap({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const deleteS = "Supprimer le fond de plan";

  // data

  const deleteBaseMap = useDeleteBaseMap();

  // state

  const [open, setOpen] = useState(false);
  const [annotationCount, setAnnotationCount] = useState(0);

  // helpers

  const deleteMessage =
    annotationCount > 0
      ? `${annotationCount} annotation(s) sont dessinées sur ce fond de plan et seront également supprimées.`
      : undefined;

  // handlers

  async function handleClick() {
    setAnnotationCount(await countBaseMapAnnotations(baseMap.id));
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  async function confirmDelete() {
    setOpen(false);
    await deleteBaseMap(baseMap);
    dispatch(setSelectedBaseMapId(null));
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
        message={deleteMessage}
      />
    </>
  );
}
