import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedVersionId } from "../baseMapEditorSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { IconButton, Menu, MenuItem } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import useDeleteBaseMap, {
  countBaseMapAnnotations,
} from "Features/baseMaps/hooks/useDeleteBaseMap";

export default function IconButtonMoreActionsBaseMap({
  baseMap,
  onOpenProperties,
  onRename,
  onAddVersion,
  ...iconButtonProps
}) {
  const dispatch = useDispatch();

  // strings

  const propertiesS = "Propriétés du fond de plan";
  const renameS = "Renommer";
  const addVersionS = "Nouvelle version";
  const deleteS = "Supprimer le fond de plan";

  // data

  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const deleteBaseMap = useDeleteBaseMap();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [annotationCount, setAnnotationCount] = useState(0);

  // helpers

  const deleteMessage =
    annotationCount > 0
      ? `${annotationCount} annotation(s) sont dessinées sur ce fond de plan et seront également supprimées.`
      : undefined;

  // handlers

  function handleClick(event) {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleOpenProperties() {
    setAnchorEl(null);
    onOpenProperties?.();
  }

  function handleRename() {
    setAnchorEl(null);
    onRename?.();
  }

  function handleAddVersion() {
    setAnchorEl(null);
    onAddVersion?.();
  }

  async function handleDelete() {
    setAnchorEl(null);
    setAnnotationCount(await countBaseMapAnnotations(baseMap.id));
    setOpenDelete(true);
  }

  async function handleConfirmDelete() {
    setOpenDelete(false);
    await deleteBaseMap(baseMap);
    if (selectedBaseMapId === baseMap.id) {
      dispatch(setSelectedMainBaseMapId(null));
      dispatch(setSelectedVersionId(null));
      dispatch(setSelectedItem({}));
    }
  }

  // render

  return (
    <>
      <IconButton size="small" onClick={handleClick} {...iconButtonProps}>
        <MoreActionsIcon fontSize="inherit" />
      </IconButton>

      <Menu open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleClose}>
        {onOpenProperties && (
          <MenuItem onClick={handleOpenProperties}>{propertiesS}</MenuItem>
        )}
        {onRename && <MenuItem onClick={handleRename}>{renameS}</MenuItem>}
        <MenuItem onClick={handleAddVersion}>{addVersionS}</MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
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
