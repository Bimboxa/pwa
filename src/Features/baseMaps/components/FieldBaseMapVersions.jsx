import { useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import { setSelectedVersionId } from "Features/baseMapEditor/baseMapEditorSlice";
import {
  selectSelectedItems,
  setSelectedItem,
} from "Features/selection/selectionSlice";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Chip,
} from "@mui/material";
import {
  DragIndicator,
  Add as AddIcon,
} from "@mui/icons-material";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import useDndSensors from "App/hooks/useDndSensors";
import db from "App/db/db";

function SortableVersionRow({ version, isSelected, onClick, onDoubleClick }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: version.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ListItemButton
      ref={setNodeRef}
      {...attributes}
      component="div"
      selected={isSelected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      sx={{ py: 0.5, px: 2, ...style }}
    >
      <ListItemIcon
        {...listeners}
        sx={{ minWidth: 24, mr: 0.5, cursor: "grab" }}
      >
        <DragIndicator fontSize="small" sx={{ opacity: 0.4 }} />
      </ListItemIcon>
      <Avatar
        src={version.image?.thumbnail}
        variant="rounded"
        sx={{ width: 24, height: 24, mr: 1 }}
      />
      <ListItemText
        primary={version.label || "Version"}
        slotProps={{
          primary: {
            variant: "body2",
            noWrap: true,
            fontWeight: version.isActive ? "bold" : "normal",
          },
        }}
      />
      {version.isActive && (
        <Chip
          label="Active"
          size="small"
          color="primary"
          sx={{ height: 18, fontSize: "0.65rem" }}
        />
      )}
    </ListItemButton>
  );
}

export default function FieldBaseMapVersions({ baseMap }) {
  const dispatch = useDispatch();

  // data

  const sensors = useDndSensors();
  const selectedVersionId = useSelector(
    (s) => s.baseMapEditor.selectedVersionId
  );
  const selectedItems = useSelector(selectSelectedItems);
  const listingId = selectedItems[0]?.listingId;

  const sortedVersions = useMemo(() => {
    if (!baseMap?.versions?.length) return [];
    return [...baseMap.versions].sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
  }, [baseMap?.versions]);

  const versionIds = useMemo(
    () => sortedVersions.map((v) => v.id),
    [sortedVersions]
  );

  // handlers

  function handleVersionClick(version) {
    dispatch(setSelectedVersionId(version.id));
    dispatch(
      setSelectedItem({
        id: version.id,
        type: "BASE_MAP_VERSION",
        listingId,
        baseMapId: baseMap.id,
      })
    );
  }

  async function handleActivateVersion(version) {
    if (!baseMap?.id || version.isActive) return;
    const record = await db.baseMaps.get(baseMap.id);
    if (!record?.versions) return;
    const updatedVersions = record.versions.map((v) => ({
      ...v,
      isActive: v.id === version.id,
    }));
    await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const oldIdx = sortedVersions.findIndex((v) => v.id === active.id);
    const newIdx = sortedVersions.findIndex((v) => v.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    let newFI;
    if (oldIdx < newIdx) {
      const b = sortedVersions[newIdx]?.fractionalIndex ?? null;
      const a =
        newIdx + 1 < sortedVersions.length
          ? sortedVersions[newIdx + 1]?.fractionalIndex
          : null;
      newFI = generateKeyBetween(b, a);
    } else {
      const b =
        newIdx > 0
          ? sortedVersions[newIdx - 1]?.fractionalIndex
          : null;
      const a = sortedVersions[newIdx]?.fractionalIndex ?? null;
      newFI = generateKeyBetween(b, a);
    }

    const record = await db.baseMaps.get(baseMap.id);
    if (!record?.versions) return;
    const updatedVersions = record.versions.map((v) =>
      v.id === active.id ? { ...v, fractionalIndex: newFI } : v
    );
    await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
  }

  async function handleAddVersion() {
    if (!baseMap?.id) return;

    const record = await db.baseMaps.get(baseMap.id);
    if (!record?.versions?.length) return;

    const activeVersion =
      record.versions.find((v) => v.isActive) || record.versions[0];

    const versionId = nanoid();
    let newImage = activeVersion.image;
    if (activeVersion.image?.fileName) {
      const srcFile = await db.files.get(activeVersion.image.fileName);
      if (srcFile) {
        const ext = activeVersion.image.fileName.split(".").pop() || "png";
        const newFileName = `version_${versionId}_${baseMap.id}.${ext}`;
        await db.files.put({ ...srcFile, fileName: newFileName });
        newImage = {
          ...activeVersion.image,
          fileName: newFileName,
          fileUpdatedAt: new Date().toISOString(),
        };
      }
    }

    const lastIndex =
      record.versions.length > 0
        ? record.versions[record.versions.length - 1].fractionalIndex
        : null;

    const newVersion = {
      id: versionId,
      label: `${activeVersion.label} (copie)`,
      fractionalIndex: generateKeyBetween(lastIndex, null),
      isActive: true,
      image: newImage,
      transform: activeVersion.transform
        ? { ...activeVersion.transform }
        : { x: 0, y: 0, rotation: 0, scale: 1 },
    };

    const updatedVersions = record.versions.map((v) => ({
      ...v,
      isActive: false,
    }));
    updatedVersions.push(newVersion);

    await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
  }

  // render

  if (!sortedVersions.length) return null;

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: 2,
          pt: 1.5,
          pb: 0.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Versions
        </Typography>
        <IconButton size="small" onClick={handleAddVersion}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={versionIds}
          strategy={verticalListSortingStrategy}
        >
          <List dense disablePadding>
            {sortedVersions.map((version) => (
              <SortableVersionRow
                key={version.id}
                version={version}
                isSelected={selectedVersionId === version.id}
                onClick={() => handleVersionClick(version)}
                onDoubleClick={() => handleActivateVersion(version)}
              />
            ))}
          </List>
        </SortableContext>
      </DndContext>
    </Box>
  );
}
