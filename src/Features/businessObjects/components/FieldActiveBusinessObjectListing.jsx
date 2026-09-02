import { useState } from "react";
import { useDispatch } from "react-redux";

import { generateKeyBetween } from "fractional-indexing";

import { setSelectedListingId } from "../businessObjectsSlice";
import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import {
  Box,
  Button,
  Checkbox,
  Typography,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import Add from "@mui/icons-material/Add";
import DragIndicator from "@mui/icons-material/DragIndicator";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import useDeleteBusinessObjectListing from "../hooks/useDeleteBusinessObjectListing";

import DialogCreateBusinessObjectListing from "./DialogCreateBusinessObjectListing";
import DialogRenameBusinessObjectListing from "./DialogRenameBusinessObjectListing";

import db from "App/db/db";

// ---------------------------------------------------------------------------
// FieldActiveBusinessObjectListing — "LISTE ACTIVE" select-style field of the
// Ouvrages panel (simplified clone of the Dessin panel's FieldActiveListing):
// menu of the scope's business-object listings with drag-reorder (fractional
// rank), a trailing "Nouvelle liste" item, and a more-menu on the field for
// renaming / deleting the active listing. With no listing at all, the field
// becomes the create CTA.
// ---------------------------------------------------------------------------

function SortableMenuItemBusinessObjectListing({ listing, selected, onSelect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id });

  return (
    <MenuItem
      ref={setNodeRef}
      selected={selected}
      onClick={() => onSelect(listing.id)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.8 : 1,
      }}
      sx={{
        gap: 1,
        py: 0.75,
        // Selection flag: secondary left border (replaces the tick).
        borderLeft: "3px solid",
        borderLeftColor: selected ? "secondary.main" : "transparent",
      }}
    >
      <Box
        component="span"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          ml: -0.5,
          color: "panel.iconMuted",
          cursor: "grab",
          touchAction: "none",
          "&:active": { cursor: "grabbing" },
        }}
      >
        <DragIndicator sx={{ fontSize: 16 }} />
      </Box>
      <ListItemText
        primaryTypographyProps={{
          variant: "body2",
          noWrap: true,
          fontWeight: selected ? 600 : 400,
        }}
      >
        {listing.name ?? listing.label ?? "Liste"}
      </ListItemText>
    </MenuItem>
  );
}

export default function FieldActiveBusinessObjectListing({
  listings,
  activeListing,
}) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Liste active";
  const addListingS = "Nouvelle liste";
  const createListingS = "Créer une liste d'ouvrages";

  // data

  const deleteBusinessObjectListing = useDeleteBusinessObjectListing();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [openCreateListing, setOpenCreateListing] = useState(false);
  const [openRenameListing, setOpenRenameListing] = useState(false);

  // helpers

  const hasNoListing = !listings?.length;
  const listingIds = (listings ?? []).map((l) => l.id);

  // dnd — 5px activation distance keeps plain clicks (select) working.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // handlers

  const handleSelectListing = (listingId) => {
    dispatch(setSelectedListingId(listingId));
    setMenuAnchor(null);
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!active || !over || active.id === over.id) return;
    try {
      const oldIdx = listings.findIndex((l) => l.id === active.id);
      const newIdx = listings.findIndex((l) => l.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove([...listings], oldIdx, newIdx);
      let prev = null;
      const updates = [];
      for (const l of reordered) {
        const rank = generateKeyBetween(prev, null);
        updates.push(db.listings.update(l.id, { rank }));
        prev = rank;
      }
      await Promise.all(updates);
      dispatch(triggerListingsUpdate());
    } catch (e) {
      console.error("[FieldActiveBusinessObjectListing] DnD reorder error:", e);
    }
  };

  const handleAddListing = () => {
    setMenuAnchor(null);
    setOpenCreateListing(true);
  };

  const handleFieldClick = (e) => {
    setMenuAnchor(e.currentTarget);
  };

  const handleMoreClick = (e) => {
    e.stopPropagation();
    setMoreMenuAnchor(e.currentTarget);
  };

  const handleRename = () => {
    setMoreMenuAnchor(null);
    setOpenRenameListing(true);
  };

  const handleDelete = async () => {
    setMoreMenuAnchor(null);
    if (!activeListing) return;
    await deleteBusinessObjectListing(activeListing);
    dispatch(setSelectedListingId(null));
  };

  // "Numérotation" listing display option: 3-column DPGF-like tree rendering
  // (number / label / quantity). Stored on the listing row; the menu stays
  // open so the effect is visible immediately.
  const handleToggleNumbering = async () => {
    if (!activeListing) return;
    await db.listings.update(activeListing.id, {
      showNumbering: !activeListing.showNumbering,
    });
    dispatch(triggerListingsUpdate());
  };

  // render

  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      {hasNoListing ? (
        <Button
          fullWidth
          variant="contained"
          color="secondary"
          onClick={() => setOpenCreateListing(true)}
        >
          {createListingS}
        </Button>
      ) : (
        <Box
          component="button"
          onClick={handleFieldClick}
          sx={{
            width: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
            textAlign: "left",
            px: 2,
            py: 1,
            cursor: "pointer",
            fontFamily: "inherit",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            "&:hover": { borderColor: "text.secondary" },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontSize: "0.65rem",
              }}
            >
              {labelS}
            </Typography>
            <Typography
              variant="subtitle1"
              noWrap
              sx={{ fontWeight: 700, lineHeight: 1.3 }}
            >
              {activeListing?.name ?? activeListing?.label ?? "Liste"}
            </Typography>
          </Box>
          {/* Not an IconButton: the field itself is a <button>, nesting one
              would be invalid HTML. */}
          <Box
            component="span"
            onClick={handleMoreClick}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 2,
              flexShrink: 0,
              color: "text.secondary",
              bgcolor: moreMenuAnchor ? "action.selected" : "action.hover",
              "&:hover": { bgcolor: "action.selected" },
            }}
          >
            <MoreHoriz sx={{ fontSize: 18 }} />
          </Box>
          <ExpandMore sx={{ color: "text.secondary", flexShrink: 0 }} />
        </Box>
      )}

      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
      >
        <MenuItem onClick={handleToggleNumbering} sx={{ gap: 0.5 }}>
          <Checkbox
            size="small"
            checked={Boolean(activeListing?.showNumbering)}
            sx={{ p: 0.5, ml: -1 }}
          />
          Numérotation
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleRename}>Renommer</MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          Supprimer
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              minWidth: menuAnchor?.offsetWidth ?? 240,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        <DndContext
          id="field-active-business-object-listing-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={listingIds}
            strategy={verticalListSortingStrategy}
          >
            {listings?.map((listing) => (
              <SortableMenuItemBusinessObjectListing
                key={listing.id}
                listing={listing}
                selected={listing.id === activeListing?.id}
                onSelect={handleSelectListing}
              />
            ))}
          </SortableContext>
        </DndContext>
        <Divider />
        <MenuItem onClick={handleAddListing} sx={{ gap: 1, py: 0.75 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <Add sx={{ fontSize: 18, color: "panel.textMuted" }} />
          </ListItemIcon>
          <ListItemText
            primaryTypographyProps={{
              variant: "body2",
              color: "panel.textMuted",
            }}
          >
            {addListingS}
          </ListItemText>
        </MenuItem>
      </Menu>

      {openCreateListing && (
        <DialogCreateBusinessObjectListing
          open
          onClose={() => setOpenCreateListing(false)}
        />
      )}

      {openRenameListing && activeListing && (
        <DialogRenameBusinessObjectListing
          open
          listing={activeListing}
          onClose={() => setOpenRenameListing(false)}
        />
      )}
    </Box>
  );
}
