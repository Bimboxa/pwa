import { useDispatch } from "react-redux";

import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import { Box, IconButton, List, Tooltip, Typography } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import RowListingInGroup from "./RowListingInGroup";
import useLinkedListings from "Features/listings/hooks/useLinkedListings";

import db from "App/db/db";
import useDndSensors from "App/hooks/useDndSensors";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";

// One family section of the SCOPE module panel: the family label, a "+"
// opening that family's own creation dialog, then its listings — sortable
// within the group. The header carries no icon: the family reads on each row
// (folder / listing avatar at the left, family icon in the count chip), like
// the scope rows of the dashboard.
//
// Reordering rewrites listings.rank (fractional indexing, the field the
// listings selector sorts on) for the group's rows only, the same rule as the
// Dessin panel's active-listing menu. Ranks are global to the scope but the
// groups never interleave: they are rebuilt from the entityModel type at every
// read, so a group-local renumbering cannot disturb another family's order.
export default function SectionListingsGroup({
  group,
  selection,
  itemsCountById,
  onListingClick,
  onCreateClick,
}) {
  const dispatch = useDispatch();

  // strings

  const createS = `Nouvelle liste — ${group.label}`;

  // data

  const sensors = useDndSensors();
  const { isLinkedListing } = useLinkedListings();

  // helpers

  const listings = group.listings ?? [];
  const ids = listings.map((l) => l.id);
  // A base map folder can be hidden from the recap editor; the other families
  // have no such notion here.
  const showVisibility = group.type === "BASE_MAP";

  // handlers

  async function handleDragEnd({ active, over }) {
    if (!active || !over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from === -1 || to === -1) return;

    const reordered = arrayMove([...listings], from, to);
    let prev = null;
    const updates = [];
    for (const listing of reordered) {
      // Linked listings (other scope): never ranked from the host — their
      // rank belongs to the source scope's order.
      if (isLinkedListing(listing.id)) continue;
      const rank = generateKeyBetween(prev, null);
      updates.push(db.listings.update(listing.id, { rank }));
      prev = rank;
    }
    await Promise.all(updates);
    dispatch(triggerListingsUpdate());
  }

  // render

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          pt: 1.5,
          pb: 0.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            minWidth: 0,
            color: "text.secondary",
            textTransform: "uppercase",
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
          noWrap
        >
          {group.label}
        </Typography>
        {onCreateClick && (
          <Tooltip title={createS}>
            <IconButton
              size="small"
              sx={{ color: "text.disabled" }}
              onClick={() => onCreateClick(group)}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <List disablePadding>
            {listings.map((listing) => (
              <RowListingInGroup
                key={listing.id}
                listing={listing}
                selected={selection?.includes(listing.id)}
                itemsCount={itemsCountById?.[listing.id]}
                familyType={group.type}
                familyIcon={group.icon}
                showVisibility={showVisibility}
                onClick={onListingClick}
              />
            ))}
          </List>
        </SortableContext>
      </DndContext>
    </Box>
  );
}
