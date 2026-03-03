import { useState, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setDisplayedBaseMapListingId,
  setCreatingInListingId,
  toggleListingCollapsed,
} from "../baseMapEditorSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  Divider,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Avatar,
} from "@mui/material";
import { Add, Remove, Edit, Check, Close } from "@mui/icons-material";

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

import db from "App/db/db";

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
        pl: 4,
        ...style,
        "&:hover .edit-icon": { opacity: 1 },
      }}
    >
      <Avatar
        src={baseMap?.image?.imageUrlClient}
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
  const { value: baseMaps } = useBaseMaps({
    filterByListingId: listing.id,
  });
  const updateEntity = useUpdateEntity();

  // state

  const [editingItemId, setEditingItemId] = useState(null);
  const [tempTitle, setTempTitle] = useState("");

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
    dispatch(
      setSelectedItem({
        id: baseMap.id,
        type: "BASE_MAP",
        listingId: listing.id,
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

  // render

  const isEditingListing = editingItemId === listing.id;

  return (
    <Box sx={{ mb: 1 }}>
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
                  return (
                    <SortableBaseMapRow
                      key={baseMap.id}
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
                    />
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
