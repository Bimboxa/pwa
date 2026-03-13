import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  selectSelectedItems,
  setSelectedItem,
  triggerSelectionBack,
} from "Features/selection/selectionSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useDeleteEntity from "Features/entities/hooks/useDeleteEntity";
import downloadBlob from "Features/files/utils/downloadBlob";
import addBackgroundToImage from "Features/images/utils/addBackgroundToImage";

import { Box, Typography, IconButton, Menu, MenuItem } from "@mui/material";
import {
  MoreVert as MoreActionsIcon,
  ArrowBack as Back,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import FieldBaseMapOpacity from "./FieldBaseMapOpacity";
import FieldBaseMapVersions from "./FieldBaseMapVersions";

export default function PanelBaseMapProperties() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  const deleteEntity = useDeleteEntity();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);

  // handlers

  function handleMenuClick(event) {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }

  function handleMenuClose() {
    setAnchorEl(null);
  }

  function handleDelete() {
    setAnchorEl(null);
    setOpenDelete(true);
  }

  async function handleDownloadImage() {
    setAnchorEl(null);
    const imageUrl = baseMap.getUrl();
    if (!imageUrl) return;
    const processedImageFile = await addBackgroundToImage(imageUrl, "#FFFFFF");
    if (processedImageFile) downloadBlob(processedImageFile, baseMap.name);
  }

  // render

  if (!baseMap) return null;

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton onClick={() => dispatch(triggerSelectionBack())}>
            <Back />
          </IconButton>
          <Box sx={{ ml: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Fond de plan
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {baseMap.name || "Fond de plan"}
            </Typography>
          </Box>
        </Box>

        <IconButton onClick={handleMenuClick}>
          <MoreActionsIcon />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          p: 1.5,
          overflow: "auto",
        }}
      >
        <WhiteSectionGeneric>
          <FieldBaseMapOpacity baseMap={baseMap} />
        </WhiteSectionGeneric>

        <FieldBaseMapVersions baseMap={baseMap} />
      </Box>

      <Menu open={menuOpen} anchorEl={anchorEl} onClose={handleMenuClose}>
        <MenuItem onClick={handleDownloadImage}>Télécharger l'image</MenuItem>
        <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={async () => {
          await deleteEntity({
            id: baseMap.id,
            listingId: selectedItem?.listingId,
          });
          dispatch(setSelectedItem({}));
          dispatch(setSelectedMainBaseMapId(null));
          setOpenDelete(false);
        }}
      />
    </BoxFlexVStretch>
  );
}
