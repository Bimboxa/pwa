import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  selectSelectedItems,
  setSelectedItem,
} from "Features/selection/selectionSlice";
import { setSelectedVersionId } from "Features/baseMapEditor/baseMapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMap from "../hooks/useBaseMap";

import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  MoreVert as MoreActionsIcon,
  ArrowBack as Back,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldCheck from "Features/form/components/FieldCheck";

import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";
import db from "App/db/db";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";
import useDeleteBaseMapVersion from "Features/baseMaps/hooks/useDeleteBaseMapVersion";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

// Properties of ONE version of a base map. Reached from the Versions list of
// the base map panel (row click → BASE_MAP_VERSION selection item carrying
// baseMapId) or from a version image clicked in the BASE_MAPS viewer (no
// baseMapId → main base map). Back returns to the base map panel. Image
// transformations live in the "Transfo." right-panel tool, not here.
export default function PanelBaseMapVersionProperties() {
  const dispatch = useDispatch();

  // strings

  const headerS = "Version";
  const labelS = "Libellé";
  const activeS = "Version active";
  const duplicateS = "Dupliquer";
  const deleteS = "Supprimer";
  const onlyVersionS = "Seule version : elle reste active.";

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  const selectedVersionId = useSelector(
    (s) => s.baseMapEditor.selectedVersionId
  );

  const mainBaseMap = useMainBaseMap();
  const itemBaseMap = useBaseMap({ id: selectedItem?.baseMapId ?? null });
  const baseMap = itemBaseMap ?? mainBaseMap;

  const versionId =
    selectedItem?.type === "BASE_MAP_VERSION"
      ? selectedItem.id
      : selectedVersionId;
  const version = baseMap?.versions?.find((v) => v.id === versionId);

  const deleteVersion = useDeleteBaseMapVersion();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);

  // helpers

  const canDelete = (baseMap?.versions?.length ?? 0) > 1;
  const isOnlyVersion = (baseMap?.versions?.length ?? 0) <= 1;
  const imageSize = version?.image?.imageSize;
  const infoParts = [];
  if (imageSize?.width && imageSize?.height) {
    infoParts.push(`${imageSize.width} × ${imageSize.height} px`);
  }
  const fileSizeS = stringifyFileSize(
    version?.image?.file?.size ?? version?.image?.fileSize
  );
  if (fileSizeS) infoParts.push(fileSizeS);

  // handlers

  function selectBaseMap() {
    dispatch(setSelectedVersionId(null));
    dispatch(
      setSelectedItem({
        id: baseMap.id,
        type: "BASE_MAP",
        listingId: selectedItem?.listingId ?? baseMap.listingId,
      })
    );
  }

  function handleBack() {
    selectBaseMap();
  }

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

  async function handleLabelChange(value) {
    if (!version?.id) return;
    const label = value ?? "";
    if (label === (version.label || "")) return;
    await db.baseMapVersions.update(version.id, { label });
  }

  // Active switch: ON activates this version; OFF activates the next other
  // live version (there is always exactly one active version).
  async function handleActiveChange(checked) {
    if (!baseMap?.id || !version?.id) return;
    if (checked) {
      if (!version.isActive) {
        await activateBaseMapVersion(baseMap.id, version.id, dispatch);
      }
      return;
    }
    if (!version.isActive) return;
    const other = [...(baseMap.versions || [])]
      .filter((v) => v.id !== version.id)
      .sort((a, b) =>
        (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
      )[0];
    if (other) await activateBaseMapVersion(baseMap.id, other.id, dispatch);
  }

  async function handleDuplicate() {
    setAnchorEl(null);
    if (!baseMap?.id || !version) return;

    const sortedVersions = [...(baseMap.versions || [])].sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
    const currentIdx = sortedVersions.findIndex((v) => v.id === version.id);
    const afterIndex = sortedVersions[currentIdx]?.fractionalIndex ?? null;
    const beforeIndex =
      currentIdx + 1 < sortedVersions.length
        ? sortedVersions[currentIdx + 1]?.fractionalIndex
        : null;
    const newFractionalIndex = generateKeyBetween(afterIndex, beforeIndex);

    // Raw record: image metadata without the hydrated ImageObject.
    const versionRecord = await db.baseMapVersions.get(version.id);

    await db.baseMapVersions.put({
      id: nanoid(),
      baseMapId: baseMap.id,
      projectId: baseMap.projectId,
      listingId: baseMap.listingId,
      label: `${version.label} (copie)`,
      fractionalIndex: newFractionalIndex,
      isActive: false,
      image: versionRecord?.image || version.image,
      transform: versionRecord?.transform ||
        version.transform || { x: 0, y: 0, rotation: 0, scale: 1 },
    });
  }

  async function handleConfirmDelete() {
    if (!baseMap?.id || !version?.id) return;
    await deleteVersion({ baseMapId: baseMap.id, versionId: version.id });
    setOpenDelete(false);
    selectBaseMap();
  }

  // render

  if (!baseMap || !version) return null;

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
        <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          <IconButton onClick={handleBack}>
            <Back />
          </IconButton>
          <Box sx={{ ml: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {headerS} · {baseMap.name}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
              {version.label || headerS}
            </Typography>
            {infoParts.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {infoParts.join(" — ")}
              </Typography>
            )}
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
        <FieldTextV2
          label={labelS}
          value={version.label || ""}
          onChange={handleLabelChange}
          options={{ showAsField: true, changeOnBlur: true, hideMic: true }}
        />

        <FieldCheck
          value={Boolean(version.isActive)}
          onChange={handleActiveChange}
          label={activeS}
          options={{ type: "switch", showAsField: true }}
        />
        {isOnlyVersion && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            {onlyVersionS}
          </Typography>
        )}

      </Box>

      <Menu open={menuOpen} anchorEl={anchorEl} onClose={handleMenuClose}>
        <MenuItem onClick={handleDuplicate}>{duplicateS}</MenuItem>
        <MenuItem
          onClick={handleDelete}
          disabled={!canDelete}
          sx={{ color: "error.main" }}
        >
          {deleteS}
        </MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={handleConfirmDelete}
      />
    </BoxFlexVStretch>
  );
}
