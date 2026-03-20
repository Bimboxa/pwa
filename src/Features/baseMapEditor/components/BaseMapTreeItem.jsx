import { useState, useMemo, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setDisplayedBaseMapListingId,
  setCreatingInListingId,
  toggleListingCollapsed,
  toggleBaseMapVersionsExpanded,
  setSelectedVersionId,
  toggleVersionHidden,
} from "../baseMapEditorSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  Chip,
  Divider,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
  IconButton,
  Avatar,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import {
  Edit,
  Check,
  Close,
  ExpandMore,
  ChevronRight,
  Visibility,
  VisibilityOff,
  Folder,
  FolderOpen,
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
import { generateKeyBetween } from "fractional-indexing";
import { nanoid } from "@reduxjs/toolkit";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import IconNewBaseMapVersion from "Features/icons/IconNewBaseMapVersion";

import db from "App/db/db";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";
import DialogCreateBaseMapVersion from "./DialogCreateBaseMapVersion";

function SortableVersionRow({
  version,
  isSelected,
  isHidden,
  onClick,
  onDoubleClick,
  onToggleHidden,
}) {
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
      {...listeners}
      component="div"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={style}
      sx={{
        pl: 7,
        py: 0.25,
        "&:hover .version-eye": { opacity: 1 },
      }}
    >
      <Avatar
        src={version.image?.thumbnail}
        variant="rounded"
        sx={{ width: 20, height: 20, mr: 1, opacity: isHidden ? 0.3 : 1 }}
      />
      <ListItemText
        primary={version.label}
        slotProps={{
          primary: {
            variant: "caption",
            color: isHidden
              ? "text.disabled"
              : version.isActive
                ? "text.primary"
                : "text.secondary",
            fontWeight: version.isActive ? "bold" : "normal",
            noWrap: true,
          },
        }}
      />
      {version.isActive && (
        <Chip
          label="Active"
          size="small"
          color="primary"
          sx={{ height: 18, fontSize: "0.65rem", mr: 0.5 }}
        />
      )}
      <IconButton
        size="small"
        className="version-eye"
        onClick={(e) => {
          e.stopPropagation();
          onToggleHidden();
        }}
        sx={{ opacity: isHidden ? 1 : 0, transition: "0.2s", p: 0.25 }}
      >
        {isHidden ? (
          <VisibilityOff sx={{ fontSize: 14 }} color="disabled" />
        ) : (
          <Visibility sx={{ fontSize: 14 }} />
        )}
      </IconButton>
    </ListItemButton>
  );
}

function SortableBaseMapRow({
  baseMap,
  isSelected,
  onClick,
  isEditing,
  tempTitle,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onTempTitleChange,
  hasVersions,
  isVersionsExpanded,
  onToggleVersions,
  onAddVersion,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: baseMap.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ListItemButton
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      component="div"
      selected={isSelected}
      onClick={onClick}
      sx={{
        pl: hasVersions ? 2 : 4,
        ...style,
        "&:hover .hover-action": { opacity: 1 },
      }}
    >
      {hasVersions && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVersions();
          }}
          sx={{ p: 0, mr: 0.5 }}
        >
          {isVersionsExpanded ? (
            <ExpandMore sx={{ fontSize: 16 }} />
          ) : (
            <ChevronRight sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      )}
      <Avatar
        src={baseMap?.getThumbnail?.() || baseMap?.image?.thumbnail}
        variant="rounded"
        sx={{ width: 28, height: 28, mr: 1 }}
      />
      {isEditing ? (
        <InputBase
          value={tempTitle}
          onChange={(e) => onTempTitleChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") onConfirmEdit();
            else if (e.key === "Escape") onCancelEdit();
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          sx={{ fontSize: "0.875rem", flex: 1 }}
        />
      ) : (
        <ListItemText
          primary={baseMap.name}
          slotProps={{
            primary: {
              variant: "body2",
              fontWeight: isSelected ? "bold" : "normal",
              noWrap: true,
            },
          }}
        />
      )}
      {isEditing ? (
        <Box sx={{ display: "flex", ml: 1 }}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onConfirmEdit();
            }}
            sx={{ color: "success.main" }}
          >
            <Check fontSize="inherit" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onCancelEdit();
            }}
            sx={{ color: "error.main" }}
          >
            <Close fontSize="inherit" />
          </IconButton>
        </Box>
      ) : (
        <Box sx={{ display: "flex" }}>
          <IconButton
            size="small"
            className="hover-action"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            sx={{ opacity: 0, transition: "0.2s" }}
          >
            <Edit fontSize="inherit" />
          </IconButton>
          <Tooltip title="Nouvelle version">
            <IconButton
              size="small"
              className="hover-action"
              onClick={(e) => {
                e.stopPropagation();
                onAddVersion();
              }}
              sx={{ opacity: 0, transition: "0.2s" }}
            >
              <IconNewBaseMapVersion sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </ListItemButton>
  );
}

export default function BaseMapTreeItem({ listing }) {
  const dispatch = useDispatch();

  // data

  const selectedBaseMapId = useSelector(
    (s) => s.mapEditor.selectedBaseMapId
  );
  const displayedListingId = useSelector(
    (s) => s.baseMapEditor.displayedBaseMapListingId
  );
  const collapsedListingIds = useSelector(
    (s) => s.baseMapEditor.collapsedListingIds
  );
  const expandedBaseMapVersionIds = useSelector(
    (s) => s.baseMapEditor.expandedBaseMapVersionIds
  );
  const selectedVersionId = useSelector(
    (s) => s.baseMapEditor.selectedVersionId
  );
  const hiddenVersionIds = useSelector(
    (s) => s.baseMapEditor.hiddenVersionIds
  );
  const { value: baseMaps } = useBaseMaps({
    filterByListingId: listing.id,
  });
  const updateEntity = useUpdateEntity();
  const createVersion = useCreateBaseMapVersion();

  // state

  const [editingItemId, setEditingItemId] = useState(null);
  const [tempTitle, setTempTitle] = useState("");
  const fileInputRef = useRef(null);
  const [addVersionBaseMapId, setAddVersionBaseMapId] = useState(null);
  const [createVersionForBaseMap, setCreateVersionForBaseMap] = useState(null);

  // helpers

  const isDisplayed = displayedListingId === listing.id;
  const isExpanded = !collapsedListingIds.includes(listing.id);
  const baseMapIds = useMemo(
    () => (baseMaps || []).map((bm) => bm.id),
    [baseMaps]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // handlers

  function handleToggleCollapsed(e) {
    e.stopPropagation();
    dispatch(toggleListingCollapsed(listing.id));
  }

  function handleListingClick() {
    if (editingItemId === listing.id) return;
    dispatch(setDisplayedBaseMapListingId(listing.id));
    dispatch(setSelectedMainBaseMapId(null));
    dispatch(setSelectedVersionId(null));
    dispatch(
      setSelectedItem({
        id: listing.id,
        type: "LISTING",
      })
    );
  }

  function handleBaseMapClick(baseMap) {
    if (editingItemId === baseMap.id) return;
    dispatch(setDisplayedBaseMapListingId(listing.id));
    dispatch(setSelectedBaseMapsListingId(listing.id));
    dispatch(setSelectedMainBaseMapId(baseMap.id));
    dispatch(setCreatingInListingId(null));
    dispatch(setSelectedVersionId(null));
    dispatch(
      setSelectedItem({
        id: baseMap.id,
        type: "BASE_MAP",
        listingId: listing.id,
      })
    );
  }

  async function handleVersionClick(baseMap, version) {
    dispatch(setDisplayedBaseMapListingId(listing.id));
    dispatch(setSelectedBaseMapsListingId(listing.id));
    dispatch(setSelectedMainBaseMapId(baseMap.id));
    dispatch(setCreatingInListingId(null));
    dispatch(
      setSelectedItem({
        id: version.id,
        type: "BASE_MAP_VERSION",
        listingId: listing.id,
        baseMapId: baseMap.id,
      })
    );
    await activateBaseMapVersion(baseMap.id, version.id, dispatch);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || !baseMaps) return;

    const oldIndex = baseMapIds.indexOf(active.id);
    const newIndex = baseMapIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Ensure all baseMaps have a sortIndex before computing new position
    const needsInit = baseMaps.some((bm) => bm.sortIndex == null);
    let sortIndices;
    if (needsInit) {
      sortIndices = [];
      let prev = null;
      for (let i = 0; i < baseMaps.length; i++) {
        const idx = baseMaps[i].sortIndex ?? generateKeyBetween(prev, null);
        sortIndices.push(idx);
        prev = idx;
      }
      // Persist initial sortIndex for items that don't have one
      await Promise.all(
        baseMaps.map((bm, i) => {
          if (bm.sortIndex == null) {
            return updateEntity(
              bm.id,
              { sortIndex: sortIndices[i] },
              { listing }
            );
          }
          return null;
        })
      );
    } else {
      sortIndices = baseMaps.map((bm) => bm.sortIndex);
    }

    // Compute new sortIndex for dragged item
    let newSortIndex;
    if (oldIndex < newIndex) {
      const b = sortIndices[newIndex];
      const a = newIndex + 1 < baseMaps.length ? sortIndices[newIndex + 1] : null;
      newSortIndex = generateKeyBetween(b, a);
    } else {
      const b = newIndex > 0 ? sortIndices[newIndex - 1] : null;
      const a = sortIndices[newIndex];
      newSortIndex = generateKeyBetween(b, a);
    }

    await updateEntity(
      active.id,
      { sortIndex: newSortIndex },
      { listing }
    );
  }

  async function handleActivateVersion(baseMap, version) {
    await activateBaseMapVersion(baseMap.id, version.id, dispatch);
  }

  // handlers - edit title

  function handleStartEditListing(e) {
    e.stopPropagation();
    setEditingItemId(listing.id);
    setTempTitle(listing.name);
  }

  async function handleConfirmEditListing() {
    await db.listings.update(listing.id, { name: tempTitle });
    setEditingItemId(null);
  }

  function handleStartEditBaseMap(baseMap) {
    setEditingItemId(baseMap.id);
    setTempTitle(baseMap.name);
  }

  async function handleConfirmEditBaseMap(baseMapId) {
    await updateEntity(baseMapId, { name: tempTitle }, { listing });
    setEditingItemId(null);
  }

  function handleCancelEdit() {
    setEditingItemId(null);
  }

  function handleAddBaseMap() {
    dispatch(setDisplayedBaseMapListingId(listing.id));
    dispatch(setCreatingInListingId(listing.id));
  }

  // handlers - versions

  function handleAddVersionClick(baseMapId) {
    setAddVersionBaseMapId(baseMapId);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (file && addVersionBaseMapId) {
      await createVersion(addVersionBaseMapId, file, {
        label: "Nouvelle version",
      });
    }
    setAddVersionBaseMapId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDuplicateActiveVersion(baseMap) {
    if (!baseMap?.versions?.length) return;

    // Read the active version record from the new table
    const activeVersionHydrated =
      baseMap.versions.find((v) => v.isActive) || baseMap.versions[0];
    const activeVersionRecord = await db.baseMapVersions.get(activeVersionHydrated.id);
    if (!activeVersionRecord) return;

    // Copy the image file
    const versionId = nanoid();
    let newImage = activeVersionRecord.image;
    if (activeVersionRecord.image?.fileName) {
      const srcFile = await db.files.get(activeVersionRecord.image.fileName);
      if (srcFile) {
        const ext = activeVersionRecord.image.fileName.split(".").pop() || "png";
        const newFileName = `version_${versionId}_${baseMap.id}.${ext}`;
        await db.files.put({
          ...srcFile,
          fileName: newFileName,
        });
        newImage = {
          ...activeVersionRecord.image,
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
    await activateBaseMapVersion(baseMap.id, null);
    await db.baseMapVersions.put({
      id: versionId,
      baseMapId: baseMap.id,
      projectId: baseMap.projectId,
      listingId: baseMap.listingId,
      label: `${activeVersionRecord.label} (copie)`,
      fractionalIndex: generateKeyBetween(lastIndex, null),
      isActive: true,
      image: newImage,
      transform: activeVersionRecord.transform
        ? { ...activeVersionRecord.transform }
        : { x: 0, y: 0, rotation: 0, scale: 1 },
    });
  }

  async function handleCreateVersionFromDialog({ label, sourceBaseMap, sourceVersion }) {
    const targetBaseMap = createVersionForBaseMap;
    if (!targetBaseMap) return;

    // Copy the image file from the source version
    const versionId = nanoid();
    let newImage = sourceVersion.image;
    if (sourceVersion.image?.fileName) {
      const srcFile = await db.files.get(sourceVersion.image.fileName);
      if (srcFile) {
        const ext = sourceVersion.image.fileName.split(".").pop() || "png";
        const newFileName = `version_${versionId}_${targetBaseMap.id}.${ext}`;
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
      .equals(targetBaseMap.id)
      .toArray();
    const sorted = existingVersions
      .filter((v) => !v.deletedAt)
      .sort((a, b) =>
        (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
      );
    const lastIndex =
      sorted.length > 0 ? sorted[sorted.length - 1].fractionalIndex : null;

    // Deactivate all existing versions, then create the new one
    await activateBaseMapVersion(targetBaseMap.id, null);
    await db.baseMapVersions.put({
      id: versionId,
      baseMapId: targetBaseMap.id,
      projectId: targetBaseMap.projectId,
      listingId: targetBaseMap.listingId,
      label,
      fractionalIndex: generateKeyBetween(lastIndex, null),
      isActive: true,
      image: newImage,
      transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    });

    setCreateVersionForBaseMap(null);
  }

  // render

  const isEditingListing = editingItemId === listing.id;

  return (
    <Box sx={{ mb: 1 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      <ListItemButton
        onClick={handleListingClick}
        sx={{
          pl: 1,
          "&:hover .edit-icon": { opacity: 1 },
        }}
      >
        <IconButton
          size="small"
          onClick={handleToggleCollapsed}
          sx={{ mr: 1, p: 0 }}
        >
          {isExpanded ? (
            <FolderOpen fontSize="small" color="action" />
          ) : (
            <Folder fontSize="small" color="action" />
          )}
        </IconButton>
        {isEditingListing ? (
          <InputBase
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleConfirmEditListing();
              else if (e.key === "Escape") handleCancelEdit();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            sx={{ fontSize: "0.875rem", flex: 1 }}
          />
        ) : (
          <ListItemText
            primary={listing.name}
            slotProps={{
              primary: {
                variant: "body2",
                fontWeight: isDisplayed ? "bold" : "normal",
              },
            }}
          />
        )}
        {isEditingListing ? (
          <Box sx={{ display: "flex", ml: 1 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmEditListing();
              }}
              sx={{ color: "success.main" }}
            >
              <Check fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelEdit();
              }}
              sx={{ color: "error.main" }}
            >
              <Close fontSize="inherit" />
            </IconButton>
          </Box>
        ) : (
          <IconButton
            size="small"
            className="edit-icon"
            onClick={handleStartEditListing}
            sx={{ opacity: 0, transition: "0.2s" }}
          >
            <Edit fontSize="inherit" />
          </IconButton>
        )}
      </ListItemButton>

      {isExpanded && (
        <Box
          sx={{
            "&:hover .add-basemap-btn": { opacity: 1 },
          }}
        >
          <Divider />
          <DndContext
            id="basemap-tree-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={baseMapIds}
              strategy={verticalListSortingStrategy}
            >
              <List dense disablePadding>
                {baseMaps?.map((baseMap) => {
                  const isBaseMapSelected =
                    selectedBaseMapId === baseMap.id;
                  const hasVersions =
                    baseMap.versions && baseMap.versions.length > 1;
                  const isVersionsExpanded =
                    expandedBaseMapVersionIds?.includes(baseMap.id);
                  const sortedVersions = hasVersions
                    ? [...baseMap.versions].sort((a, b) =>
                        (a.fractionalIndex || "").localeCompare(
                          b.fractionalIndex || ""
                        )
                      )
                    : [];
                  const sortedVersionIds = sortedVersions.map(
                    (v) => v.id
                  );

                  return (
                    <Box key={baseMap.id}>
                      <SortableBaseMapRow
                        baseMap={baseMap}
                        isSelected={isBaseMapSelected}
                        onClick={() => handleBaseMapClick(baseMap)}
                        isEditing={editingItemId === baseMap.id}
                        tempTitle={tempTitle}
                        onStartEdit={() => handleStartEditBaseMap(baseMap)}
                        onConfirmEdit={() =>
                          handleConfirmEditBaseMap(baseMap.id)
                        }
                        onCancelEdit={handleCancelEdit}
                        onTempTitleChange={setTempTitle}
                        hasVersions={hasVersions}
                        isVersionsExpanded={isVersionsExpanded}
                        onToggleVersions={() =>
                          dispatch(
                            toggleBaseMapVersionsExpanded(baseMap.id)
                          )
                        }
                        onAddVersion={() =>
                          setCreateVersionForBaseMap(baseMap)
                        }
                      />
                      {hasVersions && isVersionsExpanded && (
                        <DndContext
                          id={`version-dnd-${baseMap.id}`}
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={async (event) => {
                            const { active, over } = event;
                            if (
                              !active ||
                              !over ||
                              active.id === over.id
                            )
                              return;

                            try {
                              const oldIdx = sortedVersions.findIndex(
                                (v) => v.id === active.id
                              );
                              const newIdx = sortedVersions.findIndex(
                                (v) => v.id === over.id
                              );
                              if (oldIdx === -1 || newIdx === -1)
                                return;

                              const reordered = arrayMove(
                                [...sortedVersions],
                                oldIdx,
                                newIdx
                              );
                              let prev = null;
                              const updates = [];
                              for (const v of reordered) {
                                const fi = generateKeyBetween(
                                  prev,
                                  null
                                );
                                updates.push(
                                  db.baseMapVersions.update(
                                    v.id,
                                    { fractionalIndex: fi }
                                  )
                                );
                                prev = fi;
                              }
                              await Promise.all(updates);
                            } catch (e) {
                              console.error(
                                "[BaseMapTreeItem] DnD reorder error:",
                                e
                              );
                            }
                          }}
                        >
                          <SortableContext
                            items={sortedVersionIds}
                            strategy={verticalListSortingStrategy}
                          >
                            {sortedVersions.map((version) => (
                              <SortableVersionRow
                                key={version.id}
                                version={version}
                                isSelected={
                                  selectedVersionId === version.id
                                }
                                isHidden={hiddenVersionIds?.includes(
                                  version.id
                                )}
                                onClick={() =>
                                  handleVersionClick(baseMap, version)
                                }
                                onDoubleClick={() =>
                                  handleActivateVersion(baseMap, version)
                                }
                                onToggleHidden={() =>
                                  dispatch(
                                    toggleVersionHidden(version.id)
                                  )
                                }
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      )}
                    </Box>
                  );
                })}
              </List>
            </SortableContext>
          </DndContext>

          <ListItemButton
            className="add-basemap-btn"
            onClick={handleAddBaseMap}
            sx={{
              opacity: 0,
              transition: "opacity 0.2s",
              pl: 4,
              gap: 1,
              color: "text.disabled",
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 1,
                border: "1.5px dashed",
                borderColor: "divider",
              }}
            >
              <AddIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            </Box>
            <Typography variant="body2" color="text.disabled">
              Nouveau fond de plan
            </Typography>
          </ListItemButton>
        </Box>
      )}

      {createVersionForBaseMap && (
        <DialogCreateBaseMapVersion
          open={!!createVersionForBaseMap}
          onClose={() => setCreateVersionForBaseMap(null)}
          onConfirm={handleCreateVersionFromDialog}
        />
      )}
    </Box>
  );
}
