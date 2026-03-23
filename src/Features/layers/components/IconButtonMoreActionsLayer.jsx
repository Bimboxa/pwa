import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
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
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const allLayers = useLayers({ filterByBaseMapId: layer?.baseMapId, filterByScopeId: selectedScopeId });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);

  // data

  const annotationCount = useLiveQuery(
    async () => {
      if (!layer?.id || !layer?.baseMapId) return 0;
      const annotations = await db.annotations
        .where("baseMapId")
        .equals(layer.baseMapId)
        .toArray();
      let filtered = annotations.filter(
        (a) => !a.deletedAt && !a.isBaseMapAnnotation && a.layerId === layer.id
      );
      if (selectedScopeId) {
        const listingIds = [
          ...new Set(filtered.map((a) => a.listingId).filter(Boolean)),
        ];
        if (listingIds.length > 0) {
          const listings = await db.listings
            .where("id")
            .anyOf(listingIds)
            .toArray();
          const scopeListingIds = new Set(
            listings
              .filter((l) => l.scopeId === selectedScopeId)
              .map((l) => l.id)
          );
          filtered = filtered.filter(
            (a) => !a.listingId || scopeListingIds.has(a.listingId)
          );
        }
      }
      return filtered.length;
    },
    [layer?.id, layer?.baseMapId, selectedScopeId, annotationsUpdatedAt],
    0
  );

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
          annotationCount={annotationCount}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
