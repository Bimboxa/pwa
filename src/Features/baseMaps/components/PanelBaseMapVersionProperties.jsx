import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  selectSelectedItems,
  setSelectedItem,
} from "Features/selection/selectionSlice";
import { setSelectedVersionId } from "Features/baseMapEditor/baseMapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  InputBase,
} from "@mui/material";
import {
  MoreVert as MoreActionsIcon,
  ArrowBack as Back,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import SectionVersionTransforms from "./SectionVersionTransforms";

import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";
import db from "App/db/db";

export default function PanelBaseMapVersionProperties() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const selectedVersionId = useSelector(
    (s) => s.baseMapEditor.selectedVersionId
  );
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];

  const version = baseMap?.versions?.find((v) => v.id === selectedVersionId);

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);
  const [labelValue, setLabelValue] = useState(null);

  // helpers

  const isEditing = labelValue !== null;
  const displayLabel = isEditing ? labelValue : version?.label || "";

  // handlers

  function handleBack() {
    dispatch(setSelectedVersionId(null));
    dispatch(
      setSelectedItem({
        id: baseMap.id,
        type: "BASE_MAP",
        listingId: selectedItem?.listingId,
      })
    );
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

  async function handleSetActive() {
    setAnchorEl(null);
    if (!baseMap?.id || !selectedVersionId) return;
    const record = await db.baseMaps.get(baseMap.id);
    if (!record?.versions) return;
    const updatedVersions = record.versions.map((v) => ({
      ...v,
      isActive: v.id === selectedVersionId,
    }));
    await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
  }

  async function handleDuplicate() {
    setAnchorEl(null);
    if (!baseMap?.id || !version) return;
    const record = await db.baseMaps.get(baseMap.id);
    if (!record?.versions) return;

    const sortedVersions = [...record.versions].sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
    const currentIdx = sortedVersions.findIndex(
      (v) => v.id === selectedVersionId
    );
    const afterIndex = sortedVersions[currentIdx]?.fractionalIndex ?? null;
    const beforeIndex =
      currentIdx + 1 < sortedVersions.length
        ? sortedVersions[currentIdx + 1]?.fractionalIndex
        : null;
    const newFractionalIndex = generateKeyBetween(afterIndex, beforeIndex);

    const newVersion = {
      ...version,
      id: nanoid(),
      label: `${version.label} (copie)`,
      fractionalIndex: newFractionalIndex,
      isActive: false,
    };

    const updatedVersions = [...record.versions, newVersion];
    await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
  }

  // handlers - label

  function handleLabelFocus() {
    setLabelValue(version?.label || "");
  }

  async function handleLabelBlur() {
    if (labelValue !== null && baseMap?.id && selectedVersionId) {
      const record = await db.baseMaps.get(baseMap.id);
      if (record?.versions) {
        const updatedVersions = record.versions.map((v) =>
          v.id === selectedVersionId ? { ...v, label: labelValue } : v
        );
        await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
      }
    }
    setLabelValue(null);
  }

  function handleLabelKeyDown(e) {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      setLabelValue(null);
    }
  }

  // render

  if (!baseMap || !version) return null;

  const canDelete = baseMap.versions?.length > 1;

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
          <IconButton onClick={handleBack}>
            <Back />
          </IconButton>
          <Box sx={{ ml: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Version
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {version.label || "Version"}
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
          <Box sx={{ p: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Nom
            </Typography>
            <InputBase
              value={displayLabel}
              onChange={(e) => setLabelValue(e.target.value)}
              onFocus={handleLabelFocus}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              fullWidth
              sx={{ fontSize: "0.875rem" }}
            />
          </Box>
        </WhiteSectionGeneric>

        <SectionVersionTransforms
          baseMap={baseMap}
          versionId={selectedVersionId}
        />
      </Box>

      <Menu open={menuOpen} anchorEl={anchorEl} onClose={handleMenuClose}>
        <MenuItem onClick={handleSetActive} disabled={version.isActive}>
          Définir comme active
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>Dupliquer</MenuItem>
        <MenuItem onClick={handleDelete} disabled={!canDelete}>
          Supprimer
        </MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={async () => {
          if (!baseMap?.id || !selectedVersionId) return;
          const record = await db.baseMaps.get(baseMap.id);
          if (!record?.versions) return;
          const updatedVersions = record.versions.filter(
            (v) => v.id !== selectedVersionId
          );
          await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
          dispatch(setSelectedVersionId(null));
          dispatch(
            setSelectedItem({
              id: baseMap.id,
              type: "BASE_MAP",
              listingId: selectedItem?.listingId,
            })
          );
          setOpenDelete(false);
        }}
      />
    </BoxFlexVStretch>
  );
}
