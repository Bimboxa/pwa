import { useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import { generateKeyBetween } from "fractional-indexing";

import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { DragIndicator } from "@mui/icons-material";

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

import useListings from "Features/listings/hooks/useListings";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import db from "App/db/db";

// -- Sortable row --

function SortableListingRow({ listing }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id });

  // helpers

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1200 : "auto",
    opacity: isDragging ? 0.8 : 1,
  };

  // render

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ListItemButton component="div" sx={{ py: 0.5, px: 2 }}>
        <ListItemIcon
          {...listeners}
          sx={{ minWidth: 24, mr: 0.5, cursor: "grab" }}
        >
          <DragIndicator fontSize="small" sx={{ opacity: 0.4 }} />
        </ListItemIcon>
        <ListItemText
          primary={listing.name || listing.key || "Liste"}
          slotProps={{
            primary: {
              variant: "body2",
              noWrap: true,
            },
          }}
        />
      </ListItemButton>
    </div>
  );
}

// -- Main component --

export default function FieldSortableListings() {
  const dispatch = useDispatch();

  // data

  const { value: scope } = useSelectedScope();
  const isBaseMapsViewer = useSelector(
    (s) => s.viewers.activeViewerKey === "BASE_MAPS"
  );

  const { value: listings } = useListings({
    filterByScopeId: scope?.id,
    filterByEntityModelType: "LOCATED_ENTITY",
    ...(isBaseMapsViewer
      ? { filterByIsForBaseMaps: true }
      : { excludeIsForBaseMaps: true }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedListings = useMemo(() => {
    if (!listings?.length) return [];
    return [...listings].sort((a, b) =>
      (a.rank ?? "").toString().localeCompare((b.rank ?? "").toString())
    );
  }, [listings]);

  const listingIds = useMemo(
    () => sortedListings.map((l) => l.id),
    [sortedListings]
  );

  // handlers

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    try {
      const oldIdx = sortedListings.findIndex((l) => l.id === active.id);
      const newIdx = sortedListings.findIndex((l) => l.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove([...sortedListings], oldIdx, newIdx);
      let prev = null;
      const updates = [];
      for (const l of reordered) {
        const fi = generateKeyBetween(prev, null);
        updates.push(db.listings.update(l.id, { rank: fi }));
        prev = fi;
      }
      await Promise.all(updates);
      dispatch(triggerListingsUpdate());
    } catch (e) {
      console.error("[FieldSortableListings] DnD reorder error:", e);
    }
  }

  // render

  if (!sortedListings.length) return null;

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        flexShrink: 0,
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
          Listes d'annotations
        </Typography>
      </Box>

      <DndContext
        id="field-sortable-listings"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={listingIds}
          strategy={verticalListSortingStrategy}
        >
          <List dense disablePadding>
            {sortedListings.map((listing) => (
              <SortableListingRow key={listing.id} listing={listing} />
            ))}
          </List>
        </SortableContext>
      </DndContext>
    </Box>
  );
}
