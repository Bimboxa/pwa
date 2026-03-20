import { useMemo, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { nanoid } from "nanoid";
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
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  DragIndicator,
  Add as AddIcon,
} from "@mui/icons-material";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import useReplaceVersionImage from "Features/baseMaps/hooks/useReplaceVersionImage";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";
import db from "App/db/db";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCompareTwoImages from "Features/baseMapTransforms/components/SectionCompareTwoImages";
import DialogCreateBaseMapVersion from "Features/baseMapEditor/components/DialogCreateBaseMapVersion";

function SortableVersionRow({ version, isSelected, onClick, onDoubleClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: version.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1200 : "auto",
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ListItemButton
        component="div"
        selected={isSelected}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        sx={{ py: 0.5, px: 2 }}
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
    </div>
  );
}

export default function FieldBaseMapVersions({ baseMap }) {
  const dispatch = useDispatch();

  // data

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const createVersion = useCreateBaseMapVersion();
  const replaceVersionImage = useReplaceVersionImage();
  const fileInputRef = useRef(null);
  const [openCompare, setOpenCompare] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newFileObjectUrl, setNewFileObjectUrl] = useState(null);
  const [newFile, setNewFile] = useState(null);
  const [createNewVersion, setCreateNewVersion] = useState(true);
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
    await activateBaseMapVersion(baseMap.id, version.id, dispatch);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    try {
      const oldIdx = sortedVersions.findIndex((v) => v.id === active.id);
      const newIdx = sortedVersions.findIndex((v) => v.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove([...sortedVersions], oldIdx, newIdx);
      let prev = null;
      const updates = [];
      for (const v of reordered) {
        const fi = generateKeyBetween(prev, null);
        updates.push(db.baseMapVersions.update(v.id, { fractionalIndex: fi }));
        prev = fi;
      }
      await Promise.all(updates);
    } catch (e) {
      console.error("[FieldBaseMapVersions] DnD reorder error:", e);
    }
  }

  function handleAddClick() {
    setOpenCreateDialog(true);
  }

  async function handleCreateVersionFromDialog({ label, sourceBaseMap, sourceVersion }) {
    if (!baseMap?.id) return;
    try {
      // Copy the image file from the source version
      const versionId = nanoid();
      let newImage = sourceVersion.image;
      if (sourceVersion.image?.fileName) {
        const srcFile = await db.files.get(sourceVersion.image.fileName);
        if (srcFile) {
          const ext = sourceVersion.image.fileName.split(".").pop() || "png";
          const newFileName = `version_${versionId}_${baseMap.id}.${ext}`;
          await db.files.put({
            ...srcFile,
            fileName: newFileName,
          });
          newImage = {
            ...sourceVersion.image,
            fileName: newFileName,
            fileUpdatedAt: new Date().toISOString(),
          };
        }
      }

      // Compute fractionalIndex
      const existingVersions = await db.baseMapVersions
        .where("baseMapId")
        .equals(baseMap.id)
        .toArray();
      const sorted = existingVersions
        .filter((v) => !v.deletedAt)
        .sort((a, b) =>
          (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
        );
      const lastIndex =
        sorted.length > 0 ? sorted[sorted.length - 1].fractionalIndex : null;

      // Deactivate all existing versions, then create the new one
      await activateBaseMapVersion(baseMap.id, null, dispatch);
      await db.baseMapVersions.put({
        id: versionId,
        baseMapId: baseMap.id,
        projectId: baseMap.projectId,
        listingId: baseMap.listingId,
        label,
        fractionalIndex: generateKeyBetween(lastIndex, null),
        isActive: true,
        image: newImage,
        transform: { x: 0, y: 0, rotation: 0, scale: 1 },
      });
    } catch (e) {
      console.error("[FieldBaseMapVersions] create version error:", e);
    }
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (file && baseMap?.id) {
      setNewFile(file);
      setNewFileObjectUrl(URL.createObjectURL(file));
      setOpenCompare(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleCloseCompare() {
    setOpenCompare(false);
    if (newFileObjectUrl) URL.revokeObjectURL(newFileObjectUrl);
    setNewFileObjectUrl(null);
    setNewFile(null);
  }

  async function handleSaveVersion() {
    if (!newFile || !baseMap?.id) return;

    const originalTransform = baseMap.getActiveVersionTransform();
    const originalImageSize = baseMap.getActiveImageSize();
    const newImageSize = await new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = newFileObjectUrl;
    });

    let transform;
    if (originalImageSize && newImageSize && newImageSize.width > 0) {
      const scale = (originalImageSize.width * (originalTransform?.scale || 1)) / newImageSize.width;
      transform = { ...(originalTransform || { x: 0, y: 0, rotation: 0 }), scale };
    }

    const label = newFile.name.replace(/\.[^/.]+$/, "");

    if (createNewVersion) {
      await createVersion(baseMap.id, newFile, { label, transform });
    } else {
      const activeVersion = baseMap.getActiveVersion();
      if (activeVersion) {
        await replaceVersionImage(baseMap.id, activeVersion.id, newFile, { transform });
      } else {
        await createVersion(baseMap.id, newFile, { label, transform });
      }
    }

    handleCloseCompare();
  }

  // render

  if (!sortedVersions.length) return null;

  return (
    <>
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={handleFileSelected}
    />
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
        <IconButton size="small" onClick={handleAddClick}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      <DndContext
        id={`field-versions-${baseMap.id}`}
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

    {openCreateDialog && (
      <DialogCreateBaseMapVersion
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
        onConfirm={handleCreateVersionFromDialog}
      />
    )}

    {openCompare && (
      <DialogGeneric open={openCompare} vh={90} onClose={handleCloseCompare}>
        <BoxFlexVStretch sx={{ width: 1, height: 1, position: "relative" }}>
          <SectionCompareTwoImages
            imageUrl2={baseMap.getUrl()}
            imageUrl1={newFileObjectUrl}
          />
          <Box
            sx={{
              position: "absolute",
              bottom: 8,
              right: 8,
              display: "flex",
              alignItems: "center",
              gap: 1,
              bgcolor: "white",
              borderRadius: 1,
              px: 1.5,
              py: 0.5,
              boxShadow: 2,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={createNewVersion}
                  onChange={(e) => setCreateNewVersion(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="caption" color="text.primary">
                  Nouvelle version
                </Typography>
              }
            />
            <ButtonGeneric
              label="Enregistrer"
              variant="contained"
              color="secondary"
              onClick={handleSaveVersion}
            />
          </Box>
        </BoxFlexVStretch>
      </DialogGeneric>
    )}
    </>
  );
}
