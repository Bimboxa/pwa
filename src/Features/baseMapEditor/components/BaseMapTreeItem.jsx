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
  Typography,
  IconButton,
  Avatar,
} from "@mui/material";
import {
  Add,
  Remove,
  Edit,
  Check,
  Close,
  ExpandMore,
  ChevronRight,
  Visibility,
  VisibilityOff,
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateKeyBetween } from "fractional-indexing";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";

import db from "App/db/db";

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
      selected={isSelected}
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
        "&:hover .edit-icon": { opacity: 1 },
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
        <IconButton
          size="small"
          className="edit-icon"
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          sx={{ opacity: 0, transition: "0.2s" }}
        >
          <Edit fontSize="inherit" />
        </IconButton>
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

  function handleVersionClick(baseMap, version) {
    dispatch(setDisplayedBaseMapListingId(listing.id));
    dispatch(setSelectedBaseMapsListingId(listing.id));
    dispatch(setSelectedMainBaseMapId(baseMap.id));
    dispatch(setCreatingInListingId(null));
    dispatch(setSelectedVersionId(version.id));
    dispatch(
      setSelectedItem({
        id: version.id,
        type: "BASE_MAP_VERSION",
        listingId: listing.id,
        baseMapId: baseMap.id,
      })
    );
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || !baseMaps) return;

    const oldIndex = baseMapIds.indexOf(active.id);
    const newIndex = baseMapIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    let newSortIndex;
    if (oldIndex < newIndex) {
      const b = baseMaps[newIndex]?.sortIndex ?? null;
      const a =
        newIndex + 1 < baseMaps.length
          ? baseMaps[newIndex + 1]?.sortIndex
          : null;
      newSortIndex = generateKeyBetween(b, a);
    } else {
      const b =
        newIndex > 0 ? baseMaps[newIndex - 1]?.sortIndex : null;
      const a = baseMaps[newIndex]?.sortIndex ?? null;
      newSortIndex = generateKeyBetween(b, a);
    }

    await updateEntity(
      active.id,
      { sortIndex: newSortIndex },
      { listing }
    );
  }

  async function handleVersionDragEnd(baseMap, sortedVersions) {
    return async (event) => {
      const { active, over } = event;
      if (!active || !over || active.id === over.id) return;

      const oldIndex = sortedVersions.findIndex((v) => v.id === active.id);
      const newIndex = sortedVersions.findIndex((v) => v.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      let newFractionalIndex;
      if (oldIndex < newIndex) {
        const b = sortedVersions[newIndex]?.fractionalIndex ?? null;
        const a =
          newIndex + 1 < sortedVersions.length
            ? sortedVersions[newIndex + 1]?.fractionalIndex
            : null;
        newFractionalIndex = generateKeyBetween(b, a);
      } else {
        const b =
          newIndex > 0
            ? sortedVersions[newIndex - 1]?.fractionalIndex
            : null;
        const a = sortedVersions[newIndex]?.fractionalIndex ?? null;
        newFractionalIndex = generateKeyBetween(b, a);
      }

      const record = await db.baseMaps.get(baseMap.id);
      if (!record?.versions) return;
      const updatedVersions = record.versions.map((v) =>
        v.id === active.id
          ? { ...v, fractionalIndex: newFractionalIndex }
          : v
      );
      await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
    };
  }

  async function handleActivateVersion(baseMap, version) {
    const record = await db.baseMaps.get(baseMap.id);
    if (!record?.versions) return;
    const updatedVersions = record.versions.map((v) => ({
      ...v,
      isActive: v.id === version.id,
    }));
    await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
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
        selected={isDisplayed}
        onClick={handleListingClick}
        sx={{
          pl: 1,
          "&:hover .edit-icon": { opacity: 1 },
        }}
      >
        <IconButton
          size="small"
          color="secondary"
          onClick={handleToggleCollapsed}
          sx={{ mr: 1, p: 0 }}
        >
          {isExpanded ? (
            <Remove fontSize="small" />
          ) : (
            <Add fontSize="small" />
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
        <>
          <Divider />
          <DndContext
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

                            const oldIdx = sortedVersions.findIndex(
                              (v) => v.id === active.id
                            );
                            const newIdx = sortedVersions.findIndex(
                              (v) => v.id === over.id
                            );
                            if (oldIdx === -1 || newIdx === -1) return;

                            let newFI;
                            if (oldIdx < newIdx) {
                              const b =
                                sortedVersions[newIdx]
                                  ?.fractionalIndex ?? null;
                              const a =
                                newIdx + 1 < sortedVersions.length
                                  ? sortedVersions[newIdx + 1]
                                      ?.fractionalIndex
                                  : null;
                              newFI = generateKeyBetween(b, a);
                            } else {
                              const b =
                                newIdx > 0
                                  ? sortedVersions[newIdx - 1]
                                      ?.fractionalIndex
                                  : null;
                              const a =
                                sortedVersions[newIdx]
                                  ?.fractionalIndex ?? null;
                              newFI = generateKeyBetween(b, a);
                            }

                            const record = await db.baseMaps.get(
                              baseMap.id
                            );
                            if (!record?.versions) return;
                            const updatedVersions =
                              record.versions.map((v) =>
                                v.id === active.id
                                  ? {
                                      ...v,
                                      fractionalIndex: newFI,
                                    }
                                  : v
                              );
                            await db.baseMaps.update(baseMap.id, {
                              versions: updatedVersions,
                            });
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
                      {hasVersions && isVersionsExpanded && (
                        <ListItemButton
                          sx={{ pl: 7, py: 0.25 }}
                          onClick={() =>
                            handleAddVersionClick(baseMap.id)
                          }
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            + nouvelle version
                          </Typography>
                        </ListItemButton>
                      )}
                    </Box>
                  );
                })}
              </List>
            </SortableContext>
          </DndContext>

          <ListItemButton sx={{ pl: 4 }} onClick={handleAddBaseMap}>
            <Typography variant="body2" color="text.secondary">
              + Ajouter un fond de plan
            </Typography>
          </ListItemButton>
        </>
      )}
    </Box>
  );
}
