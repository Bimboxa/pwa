import { useDispatch } from "react-redux";

import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import {
  Box,
  Button,
  IconButton,
  List,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import RowListingInGroup from "./RowListingInGroup";
import RowAllListingsInGroup from "./RowAllListingsInGroup";
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
//
// `allListingsRow` ({selected, itemsCount, onClick}, annotation listings
// group only) pins an "Afficher toutes les listes" row above the listings;
// it is not one of the sortable items.
//
// `emptyAction` ({label, onClick}, optional): a group pinned on screen while
// it has no listing yet (getListingGroupsByEntityModelType pinnedTypes) shows
// this secondary "+ label" button under its header — the invitation to
// create the first one, the header's "+" being easy to miss on an empty
// panel. Nothing is rendered without it: an empty group is then its header
// alone.
export default function SectionListingsGroup({
  group,
  selection,
  itemsCountById,
  allListingsRow,
  emptyAction,
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
  // Base map folders (scope.baseMapsSettings.disabledListingIds) and
  // annotation listings (listings.disabledAnnotationListingIds, Redux only)
  // can be hidden from the scope; the other families have no such notion.
  const showVisibility =
    group.type === "BASE_MAP" || group.type === "LOCATED_ENTITY";

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

      {emptyAction && listings.length === 0 && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            startIcon={<AddIcon />}
            onClick={emptyAction.onClick}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {emptyAction.label}
          </Button>
        </Box>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <List disablePadding>
            {allListingsRow && (
              <RowAllListingsInGroup
                selected={allListingsRow.selected}
                itemsCount={allListingsRow.itemsCount}
                familyIcon={group.icon}
                onClick={allListingsRow.onClick}
              />
            )}
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
