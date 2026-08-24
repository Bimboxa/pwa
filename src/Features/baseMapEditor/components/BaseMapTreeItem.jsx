import { useState, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setDisplayedBaseMapListingId,
  setCreatingInListingId,
  toggleListingCollapsed,
  toggleBaseMapVersionsExpanded,
  setDetailBaseMapId,
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
import { Add as AddIcon } from "@mui/icons-material";
import {
  Check,
  Close,
  DragIndicator,
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

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import db from "App/db/db";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";
import createBaseMapVersionFromSource from "Features/baseMaps/services/createBaseMapVersionFromSource";
import formatVersionDate from "Features/baseMaps/utils/formatVersionDate";
import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";
import DialogCreateBaseMapVersion from "./DialogCreateBaseMapVersion";
import IconButtonMoreActionsBaseMap from "./IconButtonMoreActionsBaseMap";
import IconButtonMoreActionsBaseMapListing from "./IconButtonMoreActionsBaseMapListing";
import IconButtonMoreActionsBaseMapVersion from "./IconButtonMoreActionsBaseMapVersion";

function SortableVersionRow({
  baseMap,
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
        "&:hover .version-more": { opacity: 1 },
        "&:hover .row-drag-handle": { opacity: 1 },
      }}
    >
      <DragIndicator
        className="row-drag-handle"
        sx={{
          fontSize: 14,
          color: "text.disabled",
          cursor: "grab",
          opacity: 0,
          transition: "0.2s",
          ml: -2.5,
          mr: 1,
        }}
      />
      <Avatar
        src={version.image?.thumbnail}
        variant="rounded"
        sx={{ width: 20, height: 20, mr: 1, opacity: isHidden ? 0.3 : 1 }}
      />
      <ListItemText
        primary={version.label}
        secondary={formatVersionDate(version.createdAt)}
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
          secondary: { variant: "caption", noWrap: true },
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
      <IconButtonMoreActionsBaseMapVersion
        baseMap={baseMap}
        version={version}
        className="version-more"
        sx={{ opacity: 0, transition: "0.2s", p: 0.25 }}
      />
    </ListItemButton>
  );
}

function SortableBaseMapRow({
  baseMap,
  listingId,
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
  onOpenProperties,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: baseMap.id,
      data: { type: "baseMap", listingId },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // subtitle "<active version> · N version(s)" (mockup)
  const activeVersion = baseMap?.getActiveVersion?.();
  const versionsCount = baseMap?.versions?.length || 1;
  const subtitleS = `${activeVersion?.label ?? "Image d'origine"} · ${versionsCount} version${versionsCount > 1 ? "s" : ""}`;

  const { label: nameS, isPlaceholder: isUnnamed } =
    getBaseMapDisplayName(baseMap);

  return (
    <ListItemButton
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      component="div"
      selected={isSelected}
      onClick={onClick}
      sx={{
        pl: 2,
        ...style,
        "&:hover .hover-action": { opacity: 1 },
        "&:hover .row-drag-handle": { opacity: 1 },
      }}
    >
      <DragIndicator
        className="row-drag-handle"
        sx={{
          fontSize: 14,
          color: "text.disabled",
          cursor: "grab",
          opacity: 0,
          transition: "0.2s",
          ml: -1.5,
          mr: 0.5,
        }}
      />
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVersions();
        }}
        sx={{
          p: 0,
          mr: 0.5,
          visibility: hasVersions ? "visible" : "hidden",
        }}
      >
        {isVersionsExpanded ? (
          <ExpandMore sx={{ fontSize: 16 }} />
        ) : (
          <ChevronRight sx={{ fontSize: 16 }} />
        )}
      </IconButton>
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
          primary={nameS}
          secondary={subtitleS}
          slotProps={{
            primary: {
              variant: "body2",
              fontWeight: isSelected ? "bold" : "normal",
              noWrap: true,
              ...(isUnnamed && {
                fontStyle: "italic",
                color: "text.secondary",
              }),
            },
            secondary: { variant: "caption", noWrap: true },
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
          <IconButtonMoreActionsBaseMap
            baseMap={baseMap}
            onOpenProperties={onOpenProperties}
            onRename={onStartEdit}
            onAddVersion={onAddVersion}
          />
        </Box>
      )}
    </ListItemButton>
  );
}

export default function BaseMapTreeItem({ listing, baseMaps, isDropTarget }) {
  const dispatch = useDispatch();

  // data

  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
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
  const hiddenVersionIds = useSelector((s) => s.baseMapEditor.hiddenVersionIds);
  const updateEntity = useUpdateEntity();

  // state

  const [editingItemId, setEditingItemId] = useState(null);
  const [tempTitle, setTempTitle] = useState("");
  const [createVersionForBaseMap, setCreateVersionForBaseMap] = useState(null);

  // helpers

  const isDisplayed = displayedListingId === listing.id;
  const isExpanded = !collapsedListingIds.includes(listing.id);
  const baseMapIds = useMemo(
    () => (baseMaps || []).map((bm) => bm.id),
    [baseMaps]
  );

  // dnd - group header (sortable group row + drop target for baseMaps)

  const {
    attributes: groupAttributes,
    listeners: groupListeners,
    setNodeRef: setGroupNodeRef,
    transform: groupTransform,
    transition: groupTransition,
  } = useSortable({ id: listing.id, data: { type: "group" } });

  const groupStyle = {
    transform: CSS.Transform.toString(groupTransform),
    transition: groupTransition,
  };

  // dnd - versions (nested contexts, independent from the tree context)

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
    // Open the base map detail view in the left panel (#312)
    dispatch(setDetailBaseMapId(baseMap.id));
  }

  // The "Propriétés du fond de plan" menu item opens the same detail view
  // as the row click (versions + Position 3D).
  function handleOpenBaseMapProperties(baseMap) {
    handleBaseMapClick(baseMap);
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

  async function handleActivateVersion(baseMap, version) {
    await activateBaseMapVersion(baseMap.id, version.id, dispatch);
  }

  // handlers - edit title

  function handleStartEditListing(e) {
    // Also triggered from the more-actions menu (no event)
    e?.stopPropagation?.();
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

  async function handleCreateVersionFromDialog({ label, sourceVersion }) {
    await createBaseMapVersionFromSource({
      targetBaseMap: createVersionForBaseMap,
      label,
      sourceVersion,
    });
    setCreateVersionForBaseMap(null);
  }

  // render

  const isEditingListing = editingItemId === listing.id;

  return (
    <Box sx={{ mb: 1 }}>
      <ListItemButton
        ref={setGroupNodeRef}
        {...groupAttributes}
        {...groupListeners}
        component="div"
        onClick={handleListingClick}
        style={groupStyle}
        sx={{
          pl: 1,
          "&:hover .row-drag-handle": { opacity: 1 },
          ...(isDropTarget && {
            bgcolor: "action.focus",
            outline: "1px dashed",
            outlineColor: "primary.main",
          }),
        }}
      >
        <DragIndicator
          className="row-drag-handle"
          sx={{
            fontSize: 14,
            color: "text.disabled",
            cursor: "grab",
            opacity: 0,
            transition: "0.2s",
            ml: -0.5,
            mr: 0.5,
          }}
        />
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
            secondary={`${baseMaps?.length || 0} fond${
              (baseMaps?.length || 0) > 1 ? "s" : ""
            } de plan`}
            slotProps={{
              primary: {
                variant: "body2",
                fontWeight: isDisplayed ? "bold" : "normal",
              },
              secondary: { variant: "caption", noWrap: true },
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
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleAddBaseMap();
              }}
              sx={{ color: "text.disabled" }}
            >
              <AddIcon fontSize="inherit" />
            </IconButton>
            <IconButtonMoreActionsBaseMapListing
              listing={listing}
              onRename={handleStartEditListing}
              onAddBaseMap={handleAddBaseMap}
              size="small"
            />
          </Box>
        )}
      </ListItemButton>

      {isExpanded && (
        <Box>
          {/* White background isolating the group's base maps from the
              panel; the "Nouveau fond de plan" row stays on the panel bg. */}
          <Box
            sx={{
              bgcolor: "background.paper",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Divider />
            <SortableContext
              items={baseMapIds}
              strategy={verticalListSortingStrategy}
            >
              <List dense disablePadding>
                {baseMaps?.map((baseMap) => {
                  const isBaseMapSelected = selectedBaseMapId === baseMap.id;
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
                  const sortedVersionIds = sortedVersions.map((v) => v.id);

                  return (
                    <Box key={baseMap.id}>
                      <SortableBaseMapRow
                        baseMap={baseMap}
                        listingId={listing.id}
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
                          dispatch(toggleBaseMapVersionsExpanded(baseMap.id))
                        }
                        onAddVersion={() => setCreateVersionForBaseMap(baseMap)}
                        onOpenProperties={() =>
                          handleOpenBaseMapProperties(baseMap)
                        }
                      />
                      {hasVersions && isVersionsExpanded && (
                        <DndContext
                          id={`version-dnd-${baseMap.id}`}
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={async (event) => {
                            const { active, over } = event;
                            if (!active || !over || active.id === over.id)
                              return;

                            try {
                              const oldIdx = sortedVersions.findIndex(
                                (v) => v.id === active.id
                              );
                              const newIdx = sortedVersions.findIndex(
                                (v) => v.id === over.id
                              );
                              if (oldIdx === -1 || newIdx === -1) return;

                              const reordered = arrayMove(
                                [...sortedVersions],
                                oldIdx,
                                newIdx
                              );
                              let prev = null;
                              const updates = [];
                              for (const v of reordered) {
                                const fi = generateKeyBetween(prev, null);
                                updates.push(
                                  db.baseMapVersions.update(v.id, {
                                    fractionalIndex: fi,
                                  })
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
                                baseMap={baseMap}
                                version={version}
                                isSelected={selectedVersionId === version.id}
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
                                  dispatch(toggleVersionHidden(version.id))
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
          </Box>

          <ListItemButton
            onClick={handleAddBaseMap}
            sx={{
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
