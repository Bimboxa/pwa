import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { generateKeyBetween } from "fractional-indexing";

import {
  setSelectedListingId,
  setHiddenListingsIds,
  triggerListingsUpdate,
} from "Features/listings/listingsSlice";
import { setAutoListingVisibility } from "Features/panelDrawing/panelDrawingSlice";

import {
  Box,
  Button,
  Chip,
  Typography,
  Menu,
  MenuItem,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Switch,
  Tooltip,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import Add from "@mui/icons-material/Add";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import DragIndicator from "@mui/icons-material/DragIndicator";

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

import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import MenuMoreActionsActiveListing from "./MenuMoreActionsActiveListing";

import useUpdateAnnotationTemplates from "Features/annotations/hooks/useUpdateAnnotationTemplates";

import db from "App/db/db";

// ---------------------------------------------------------------------------
// FieldActiveListing — "LISTE ACTIVE" select-style field of the Dessin panel.
// Opens the menu of the scope's listings: each row shows its annotations
// count (scoped like the panel) and a visibility eye; the selected row is
// flagged with a secondary left border. The bottom "Visibilité auto" switch
// makes a selection hide every other listing and unhide all the templates of
// the selected one. The trailing item creates a new listing; with no listing
// at all, the field becomes the create CTA.
// ---------------------------------------------------------------------------

// -- Sortable row: a listing MenuItem with a left drag handle. Dragging
// rewrites the `rank` of every displayed listing (fractional indexing, same
// scheme as FieldSortableListings); clicking anywhere else selects as before.

function SortableMenuItemListing({
  listing,
  selected,
  hidden,
  count,
  onSelect,
  onToggleVisibility,
}) {
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
          color: hidden ? "text.disabled" : "text.primary",
        }}
      >
        {listing.name ?? listing.label ?? "Liste"}
      </ListItemText>
      {/* Annotations count, scoped like the panel (active base map or all
          base maps). */}
      <Chip
        label={count}
        size="small"
        sx={{
          ml: "auto",
          height: 16,
          flexShrink: 0,
          "& .MuiChip-label": {
            px: 0.75,
            fontSize: "10px",
            fontFamily: "monospace",
            fontWeight: 500,
            color: hidden
              ? "text.disabled"
              : count > 0
                ? "secondary.main"
                : "panel.countEmpty",
          },
        }}
      />
      <Tooltip title={hidden ? "Afficher" : "Masquer"} arrow>
        <IconButton
          size="small"
          onClick={(e) => onToggleVisibility(e, listing.id)}
          sx={{
            p: 0.5,
            flexShrink: 0,
            color: hidden ? "secondary.main" : "panel.iconMuted",
          }}
        >
          {hidden ? (
            <VisibilityOff sx={{ fontSize: 16 }} />
          ) : (
            <Visibility sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Tooltip>
    </MenuItem>
  );
}

export default function FieldActiveListing({
  listings,
  activeListing,
  countsByListingId,
  // Hosts where creating a listing is not allowed (e.g. the popper in some
  // viewers) hide the "Nouvelle liste" entry and the empty-state CTA.
  showAddListing = true,
}) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Liste active";
  const addListingS = "Nouvelle liste";
  const createListingS = "+ Liste de modèles d'annotations";
  const autoVisibilityS = "Visibilité auto";
  const autoVisibilityTooltipS =
    "Au changement de liste : masque les autres listes et affiche tous les modèles de la liste sélectionnée.";

  // data

  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const autoVisibility = useSelector(
    (s) => s.panelDrawing.autoListingVisibility
  );

  const updateAnnotationTemplates = useUpdateAnnotationTemplates();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [openCreateListing, setOpenCreateListing] = useState(false);

  // helpers

  const hasNoListing = !listings?.length;

  // helpers - drag & drop reorder

  const sensors = useSensors(
    // 5px activation distance keeps plain clicks (select / eye) working.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const listingIds = (listings ?? []).map((l) => l.id);

  // handlers

  const handleSelectListing = async (listingId) => {
    dispatch(setSelectedListingId(listingId));
    setMenuAnchor(null);

    if (!autoVisibility) {
      // Even without auto visibility, selecting a listing always unhides it.
      if (hiddenListingsIds.includes(listingId))
        dispatch(
          setHiddenListingsIds(
            hiddenListingsIds.filter((id) => id !== listingId)
          )
        );
      return;
    }

    // Auto visibility: hide every other listing of the panel (hidden ids
    // from other scopes are preserved) and unhide all the templates of the
    // selected listing.
    const panelIds = (listings ?? []).map((l) => l.id);
    const keptHiddenIds = hiddenListingsIds.filter(
      (id) => !panelIds.includes(id)
    );
    dispatch(
      setHiddenListingsIds([
        ...keptHiddenIds,
        ...panelIds.filter((id) => id !== listingId),
      ])
    );

    const templates = await db.annotationTemplates
      .where("listingId")
      .equals(listingId)
      .toArray();
    await updateAnnotationTemplates(
      templates
        .filter((t) => !t.deletedAt && t.hidden)
        .map((t) => ({ id: t.id, hidden: false }))
    );
  };

  const handleToggleListingVisibility = (e, listingId) => {
    e.stopPropagation();
    const isHidden = hiddenListingsIds.includes(listingId);
    dispatch(
      setHiddenListingsIds(
        isHidden
          ? hiddenListingsIds.filter((id) => id !== listingId)
          : [...hiddenListingsIds, listingId]
      )
    );
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
      console.error("[FieldActiveListing] DnD reorder error:", e);
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

  // render

  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      {hasNoListing ? (
        showAddListing && (
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            onClick={() => setOpenCreateListing(true)}
          >
            {createListingS}
          </Button>
        )
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

      <MenuMoreActionsActiveListing
        anchorEl={moreMenuAnchor}
        onClose={() => setMoreMenuAnchor(null)}
        listing={activeListing}
      />

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
          id="field-active-listing-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={listingIds}
            strategy={verticalListSortingStrategy}
          >
            {listings?.map((listing) => (
              <SortableMenuItemListing
                key={listing.id}
                listing={listing}
                selected={listing.id === activeListing?.id}
                hidden={hiddenListingsIds.includes(listing.id)}
                count={countsByListingId?.[listing.id] ?? 0}
                onSelect={handleSelectListing}
                onToggleVisibility={handleToggleListingVisibility}
              />
            ))}
          </SortableContext>
        </DndContext>
        {showAddListing && <Divider />}
        {showAddListing && (
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
        )}
        <Divider />
        <Tooltip title={autoVisibilityTooltipS} arrow placement="right">
          <Box
            sx={{
              px: 2,
              py: 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {autoVisibilityS}
            </Typography>
            <Switch
              size="small"
              color="secondary"
              checked={Boolean(autoVisibility)}
              onChange={(e) =>
                dispatch(setAutoListingVisibility(e.target.checked))
              }
            />
          </Box>
        </Tooltip>
      </Menu>

      {openCreateListing && (
        <DialogCreateListing
          open={openCreateListing}
          onClose={() => setOpenCreateListing(false)}
          isForBaseMaps={false}
        />
      )}
    </Box>
  );
}
