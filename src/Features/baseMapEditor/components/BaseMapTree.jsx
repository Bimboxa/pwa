import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useDispatch, useSelector } from "react-redux";

import {
  setDisplayedBaseMapListingId,
  toggleListingCollapsed,
} from "../baseMapEditorSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Avatar,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import { CreateNewFolderOutlined, Folder } from "@mui/icons-material";

import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";

import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useCreateBaseMapListing from "../hooks/useCreateBaseMapListing";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMoveBaseMapToListing from "Features/baseMaps/hooks/useMoveBaseMapToListing";

import db, { withSystemWrite } from "App/db/db";
import ensureBaseMapSortIndexes from "Features/baseMaps/utils/ensureBaseMapSortIndexes";

import BaseMapTreeItem from "./BaseMapTreeItem";

// Collision detection: group drags only snap to other group headers;
// baseMap drags use pointer position (accurate over rows and headers).
function treeCollisionDetection(args) {
  const type = args.active?.data?.current?.type;
  if (type === "group") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data?.current?.type === "group"
      ),
    });
  }
  const within = pointerWithin(args);
  if (within.length > 0) return within;
  return rectIntersection(args);
}

export default function BaseMapTree() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const displayedListingId = useSelector(
    (s) => s.baseMapEditor.displayedBaseMapListingId
  );
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const collapsedListingIds = useSelector(
    (s) => s.baseMapEditor.collapsedListingIds
  );
  const listings = useProjectBaseMapListings();
  const { value: allBaseMaps } = useBaseMaps();
  const createListing = useCreateBaseMapListing();
  const updateEntity = useUpdateEntity();
  const moveBaseMapToListing = useMoveBaseMapToListing();

  // state

  const [activeDrag, setActiveDrag] = useState(null); // {type, item, sourceListingId}
  const [overListingId, setOverListingId] = useState(null);

  // helpers

  const baseMapsByListingId = useMemo(() => {
    const byListing = {};
    (allBaseMaps || []).forEach((bm) => {
      if (!byListing[bm.listingId]) byListing[bm.listingId] = [];
      byListing[bm.listingId].push(bm);
    });
    return byListing;
  }, [allBaseMaps]);

  const listingIds = useMemo(
    () => (listings || []).map((l) => l.id),
    [listings]
  );

  const hasEmptyListing = useMemo(() => {
    if (!listings?.length || !allBaseMaps) return false;
    return listings.some((l) => !baseMapsByListingId[l.id]?.length);
  }, [listings, allBaseMaps, baseMapsByListingId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // effects - auto-select first listing

  useEffect(() => {
    if (displayedListingId) return;
    if (!listings?.length) return;
    const first = listings[0];
    dispatch(setDisplayedBaseMapListingId(first.id));
  }, [displayedListingId, listings, dispatch]);

  // handlers

  async function handleCreateListing() {
    const listing = await createListing({
      projectId,
      title: `Fonds de plan ${(listings?.length || 0) + 1}`,
    });
    dispatch(setDisplayedBaseMapListingId(listing.id));
    dispatch(setSelectedMainBaseMapId(null));
  }

  // handlers - dnd

  function handleDragStart({ active }) {
    const type = active.data.current?.type;
    if (type === "group") {
      const item = listings?.find((l) => l.id === active.id);
      setActiveDrag(item ? { type, item } : null);
    } else if (type === "baseMap") {
      const sourceListingId = active.data.current?.listingId;
      const item = baseMapsByListingId[sourceListingId]?.find(
        (bm) => bm.id === active.id
      );
      setActiveDrag(item ? { type, item, sourceListingId } : null);
    }
  }

  function handleDragOver({ active, over }) {
    if (active.data.current?.type !== "baseMap") {
      setOverListingId(null);
      return;
    }
    const overData = over?.data?.current;
    let targetListingId = null;
    if (overData?.type === "baseMap") targetListingId = overData.listingId;
    else if (overData?.type === "group") targetListingId = over.id;
    setOverListingId(
      targetListingId !== active.data.current?.listingId
        ? targetListingId
        : null
    );
  }

  function handleDragCancel() {
    setActiveDrag(null);
    setOverListingId(null);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    const type = active.data.current?.type;
    setActiveDrag(null);
    setOverListingId(null);
    if (!over) return;

    try {
      if (type === "group") await handleGroupDragEnd(active, over);
      else if (type === "baseMap") await handleBaseMapDragEnd(active, over);
    } catch (e) {
      console.error("[BaseMapTree] DnD error:", e);
    }
  }

  async function handleGroupDragEnd(active, over) {
    if (!listings?.length || active.id === over.id) return;
    const oldIndex = listingIds.indexOf(active.id);
    const newIndex = listingIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    // Full re-rank in the new display order: robust against legacy
    // listings with no rank (or alphabetical-only ordering).
    const reordered = arrayMove([...listings], oldIndex, newIndex);
    let prev = null;
    const updates = [];
    for (const l of reordered) {
      const rank = generateKeyBetween(prev, null);
      if (l.rank !== rank) updates.push({ id: l.id, rank });
      prev = rank;
    }
    // Group order is shared display metadata, not owned content: write it
    // as a system write so non-owners can reorder groups too.
    await withSystemWrite(() =>
      db.transaction("rw", db.listings, async () => {
        for (const u of updates) {
          await db.listings.update(u.id, { rank: u.rank });
        }
      })
    );
  }

  async function handleBaseMapDragEnd(active, over) {
    if (active.id === over.id) return;

    const sourceListingId = active.data.current?.listingId;
    const overData = over.data?.current;

    let targetListingId = null;
    let overBaseMapId = null;
    if (overData?.type === "baseMap") {
      targetListingId = overData.listingId;
      overBaseMapId = over.id;
    } else if (overData?.type === "group") {
      targetListingId = over.id;
    } else {
      return;
    }

    const baseMap = baseMapsByListingId[sourceListingId]?.find(
      (bm) => bm.id === active.id
    );
    const targetListing = listings?.find((l) => l.id === targetListingId);
    if (!baseMap || !targetListing) return;

    if (targetListingId === sourceListingId) {
      if (!overBaseMapId) return; // dropped on its own group header
      await reorderBaseMapInListing(baseMap, overBaseMapId, targetListing);
    } else {
      await moveBaseMapAcrossListings(
        baseMap,
        sourceListingId,
        targetListing,
        overBaseMapId
      );
    }
  }

  async function reorderBaseMapInListing(baseMap, overBaseMapId, listing) {
    const group = baseMapsByListingId[listing.id] || [];
    const ids = group.map((bm) => bm.id);
    const oldIndex = ids.indexOf(baseMap.id);
    const newIndex = ids.indexOf(overBaseMapId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const sortIndices = await ensureBaseMapSortIndexes(
      group,
      listing,
      updateEntity
    );

    let newSortIndex;
    if (oldIndex < newIndex) {
      const b = sortIndices[newIndex];
      const a = newIndex + 1 < group.length ? sortIndices[newIndex + 1] : null;
      newSortIndex = generateKeyBetween(b, a);
    } else {
      const b = newIndex > 0 ? sortIndices[newIndex - 1] : null;
      const a = sortIndices[newIndex];
      newSortIndex = generateKeyBetween(b, a);
    }

    await updateEntity(baseMap.id, { sortIndex: newSortIndex }, { listing });
  }

  async function moveBaseMapAcrossListings(
    baseMap,
    sourceListingId,
    targetListing,
    overBaseMapId
  ) {
    const targetGroup = baseMapsByListingId[targetListing.id] || [];
    const sortIndices = await ensureBaseMapSortIndexes(
      targetGroup,
      targetListing,
      updateEntity
    );

    let newSortIndex;
    if (overBaseMapId) {
      // Insert before the hovered row
      const overIdx = targetGroup.findIndex((bm) => bm.id === overBaseMapId);
      newSortIndex = generateKeyBetween(
        overIdx > 0 ? sortIndices[overIdx - 1] : null,
        sortIndices[overIdx] ?? null
      );
    } else {
      // Dropped on the group header: append at the end
      newSortIndex = generateKeyBetween(
        sortIndices.length > 0 ? sortIndices[sortIndices.length - 1] : null,
        null
      );
    }

    await moveBaseMapToListing({
      baseMapId: baseMap.id,
      sourceListingId,
      targetListingId: targetListing.id,
      newSortIndex,
    });

    // post-move UX
    if (collapsedListingIds.includes(targetListing.id)) {
      dispatch(toggleListingCollapsed(targetListing.id));
    }
    if (selectedBaseMapId === baseMap.id) {
      dispatch(setDisplayedBaseMapListingId(targetListing.id));
      dispatch(setSelectedBaseMapsListingId(targetListing.id));
      dispatch(
        setSelectedItem({
          id: baseMap.id,
          type: "BASE_MAP",
          listingId: targetListing.id,
        })
      );
    }
  }

  // render

  return (
    <Box sx={{ p: 1 }}>
      <DndContext
        id="basemap-tree-dnd"
        sensors={sensors}
        collisionDetection={treeCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={listingIds}
          strategy={verticalListSortingStrategy}
        >
          <List dense disablePadding>
            {listings?.map((listing) => (
              <BaseMapTreeItem
                key={listing.id}
                listing={listing}
                baseMaps={baseMapsByListingId[listing.id] || []}
                isDropTarget={overListingId === listing.id}
              />
            ))}
          </List>
        </SortableContext>

        {/* Portal to body: an ancestor with a CSS transform would offset
            the overlay's fixed positioning away from the pointer. */}
        {createPortal(
          <DragOverlay dropAnimation={null}>
            {activeDrag?.type === "group" && (
              <Paper
                elevation={4}
                sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}
              >
                <Folder fontSize="small" color="action" />
                <Typography variant="body2">{activeDrag.item.name}</Typography>
              </Paper>
            )}
            {activeDrag?.type === "baseMap" && (
              <Paper
                elevation={4}
                sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}
              >
                <Avatar
                  src={
                    activeDrag.item?.getThumbnail?.() ||
                    activeDrag.item?.image?.thumbnail
                  }
                  variant="rounded"
                  sx={{ width: 28, height: 28 }}
                />
                <Typography variant="body2">{activeDrag.item.name}</Typography>
              </Paper>
            )}
          </DragOverlay>,
          document.body
        )}
      </DndContext>

      {!hasEmptyListing && (
        <ListItemButton
          onClick={handleCreateListing}
          sx={{ pl: 1, color: "text.disabled" }}
        >
          <CreateNewFolderOutlined
            sx={{ fontSize: 20, mr: 1 }}
            color="disabled"
          />
          <ListItemText
            primary="Nouveau groupe"
            slotProps={{
              primary: { variant: "body2", color: "text.disabled" },
            }}
          />
        </ListItemButton>
      )}
    </Box>
  );
}
