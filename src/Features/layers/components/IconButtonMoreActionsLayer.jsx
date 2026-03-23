import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import useDeleteLayer from "../hooks/useDeleteLayer";
import useLayers from "../hooks/useLayers";

import { setSelectedItem } from "Features/selection/selectionSlice";

import { IconButton, Menu, MenuItem, Divider } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

import DialogDeleteLayer from "./DialogDeleteLayer";

export default function IconButtonMoreActionsLayer({ layer }) {
  const dispatch = useDispatch();
  const deleteLayer = useDeleteLayer();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allLayers = useLayers({ filterByBaseMapId: layer?.baseMapId, filterByScopeId: selectedScopeId });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);

  // helpers

  const otherLayers = allLayers?.filter((l) => l.id !== layer?.id);

  // handlers

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = () => {
    setAnchorEl(null);
    setOpenDelete(true);
  };

  const handleConfirmDelete = async ({ layerId, mode, targetLayerId }) => {
    await deleteLayer({ layerId, mode, targetLayerId });
    dispatch(setSelectedItem({}));
    setOpenDelete(false);
  };

  // render

  // count annotations for this layer
  const annotationCount = 0; // will be resolved inside DialogDeleteLayer via prop

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreActionsIcon />
      </IconButton>

      <Menu open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
      </Menu>

      {openDelete && (
        <DialogDeleteLayer
          open={openDelete}
          onClose={() => setOpenDelete(false)}
          layer={layer}
          otherLayers={otherLayers}
          annotationCount={0}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
