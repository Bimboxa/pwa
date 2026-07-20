import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { toggleListingCollapsed } from "../zoningsSlice";

import {
  Box,
  Collapse,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import {
  ExpandMore,
  ChevronRight,
  MoreHoriz,
  Add,
} from "@mui/icons-material";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";

import useZones from "../hooks/useZones";
import useMoveZone from "../hooks/useMoveZone";
import useDeleteZoningListing from "../hooks/useDeleteZoningListing";
import buildZonesTree, { getZoneDescendants } from "../utils/buildZonesTree";

import ZoneTreeItem from "./ZoneTreeItem";
import DialogRenameZoningListing from "./DialogRenameZoningListing";

export default function ZoningListingItem({ listing, onAddZone }) {
  const dispatch = useDispatch();

  // data

  const collapsedListingIds = useSelector(
    (s) => s.zonings.collapsedListingIds
  );
  const { value: zones } = useZones({ listingId: listing.id });
  const deleteZoningListing = useDeleteZoningListing();
  const moveZone = useMoveZone();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [openRename, setOpenRename] = useState(false);

  // helpers

  const collapsed = collapsedListingIds.includes(listing.id);
  const flatTree = useMemo(() => buildZonesTree(zones), [zones]);
  const flatIds = useMemo(
    () => flatTree.map(({ zone }) => zone.id),
    [flatTree]
  );

  // dnd — 5px activation so plain clicks keep selecting the zone
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // handlers

  function handleToggleCollapsed() {
    dispatch(toggleListingCollapsed(listing.id));
  }

  function handleMenuClick(e) {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  }

  function handleRename() {
    setMenuAnchor(null);
    setOpenRename(true);
  }

  function handleAddRootZone() {
    setMenuAnchor(null);
    onAddZone?.(null);
  }

  async function handleDelete() {
    setMenuAnchor(null);
    await deleteZoningListing(listing);
  }

  // Drop rule: the dragged zone lands next to the hovered zone, adopting its
  // parent (so a drop position always matches what the flattened tree shows).
  // The new fractional sortIndex slots it before/after the target among the
  // target's siblings, depending on the drag direction.
  async function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const dragged = zones?.find((z) => z.id === active.id);
    const target = zones?.find((z) => z.id === over.id);
    if (!dragged || !target) return;

    // cycle guard: never drop a zone into its own subtree
    const descendants = getZoneDescendants(zones, dragged.id);
    if (descendants.some((d) => d.id === target.id)) return;

    const movingDown = flatIds.indexOf(active.id) < flatIds.indexOf(over.id);

    const targetParentId = target.parentId ?? null;
    const siblings = zones
      .filter(
        (z) => (z.parentId ?? null) === targetParentId && z.id !== dragged.id
      )
      .sort((a, b) =>
        String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
      );
    const targetIdx = siblings.findIndex((z) => z.id === target.id);
    if (targetIdx === -1) return;

    let sortIndex;
    try {
      if (movingDown) {
        const next = siblings[targetIdx + 1];
        sortIndex = generateKeyBetween(
          target.sortIndex ?? null,
          next?.sortIndex ?? null
        );
      } else {
        const prev = siblings[targetIdx - 1];
        sortIndex = generateKeyBetween(
          prev?.sortIndex ?? null,
          target.sortIndex ?? null
        );
      }
    } catch (e) {
      console.warn("[ZoningListingItem] sortIndex generation failed", e);
      return;
    }

    await moveZone(dragged.id, { parentId: targetParentId, sortIndex });
  }

  // render

  return (
    <Box>
      <ListItemButton
        onClick={handleToggleCollapsed}
        sx={{
          pl: 0.5,
          "&:hover .zoning-listing-actions": { visibility: "visible" },
        }}
      >
        {collapsed ? (
          <ChevronRight sx={{ fontSize: 18 }} color="action" />
        ) : (
          <ExpandMore sx={{ fontSize: 18 }} color="action" />
        )}
        <ListItemText
          sx={{ ml: 0.5 }}
          primary={listing.name}
          slotProps={{
            primary: { variant: "body2", noWrap: true, fontWeight: 600 },
          }}
        />
        <Box
          className="zoning-listing-actions"
          sx={{ visibility: "hidden", display: "flex", alignItems: "center" }}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onAddZone?.(null);
            }}
            title="Ajouter une zone"
          >
            <Add sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreHoriz sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </ListItemButton>

      <Collapse in={!collapsed}>
        <DndContext
          id={`zones-dnd-${listing.id}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={flatIds}
            strategy={verticalListSortingStrategy}
          >
            <List dense disablePadding>
              {flatTree.map(({ zone, depth }) => (
                <ZoneTreeItem
                  key={zone.id}
                  zone={zone}
                  depth={depth}
                  listing={listing}
                  onAddChildZone={() => onAddZone?.(zone)}
                />
              ))}
              {flatTree.length === 0 && (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ pl: 4, py: 0.5, display: "block" }}
                >
                  Aucune zone
                </Typography>
              )}
            </List>
          </SortableContext>
        </DndContext>
      </Collapse>

      <Menu
        open={Boolean(menuAnchor)}
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={handleAddRootZone}>Ajouter une zone</MenuItem>
        <MenuItem onClick={handleRename}>Renommer</MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          Supprimer
        </MenuItem>
      </Menu>

      {openRename && (
        <DialogRenameZoningListing
          open
          listing={listing}
          onClose={() => setOpenRename(false)}
        />
      )}
    </Box>
  );
}
