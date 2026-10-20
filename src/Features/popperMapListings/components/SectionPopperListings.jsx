import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DragIndicator from "@mui/icons-material/DragIndicator";
import MoreHoriz from "@mui/icons-material/MoreHoriz";

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

import AvatarListing from "Features/listings/components/AvatarListing";
import DialogChooseListingSource from "Features/listings/components/DialogChooseListingSource";
import MenuMoreActionsActiveListing from "Features/panelDrawing/components/MenuMoreActionsActiveListing";

import useLinkedListings from "Features/listings/hooks/useLinkedListings";
import useReorderListings from "Features/listings/hooks/useReorderListings";
import useSelectActiveListing from "Features/panelDrawing/hooks/useSelectActiveListing";

// ---------------------------------------------------------------------------
// SectionPopperListings — listings panel of the Dessin popper, expanded from
// the "Listes" header above the active listing band:
// the annotation listings of the scope as vertical rows, in the selector's
// rank order. Each row: drag handle (reorder = rewrite the ranks, same rule
// as the LISTE ACTIVE menu), listing avatar, name, the "..." menu of the
// listing (rename, favorites, duplicate, delete — "Retirer du …" for a
// linked listing) and the annotations count (scoped like the popper) as a
// pill that toggles the listing visibility.
// Click = select the listing (active listing of the Dessin panel, with the
// "Visibilité auto" rule) and send it to the selection as a LISTING item —
// the right panel, when open, shows its properties. A trailing row creates a
// listing; with no listing at all, the section is the create CTA.
// ---------------------------------------------------------------------------

// -- Sortable row --

function SortableRowPopperListing({
  listing,
  selected,
  hidden,
  count,
  // Listing linked from another scope ("Depuis un autre Krto"): selectable,
  // not sortable, flagged in the linked colour with the source scope's name.
  linked = false,
  sourceScopeName,
  onSelect,
  onToggleVisibility,
  onOpenMenu,
}) {
  // strings

  const dragS = "Glisser pour réordonner";
  const moreS = "Actions sur la liste";
  const showS = "Afficher la liste";
  const hideS = "Masquer la liste";
  const fromS = "Depuis";

  // data

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id, disabled: linked });

  // helpers

  const accent = linked ? "listingFromOtherScope.main" : "secondary.main";
  const variant = selected
    ? "selected"
    : hidden || count === 0
      ? "muted"
      : "visible";

  // render

  return (
    <ListItemButton
      ref={setNodeRef}
      onClick={() => onSelect(listing)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.8 : 1,
      }}
      sx={{
        gap: 1,
        pl: 0.5,
        pr: 1,
        py: 0.5,
        // Selection flag: left border, always there so selecting never
        // shifts the row; a linked listing always shows its bar.
        borderLeft: "3px solid",
        borderLeftColor: linked || selected ? accent : "transparent",
        // Selected row: same tint as the active listing band.
        bgcolor: (theme) =>
          selected ? alpha(theme.palette.secondary.main, 0.08) : "transparent",
        "&:hover": {
          bgcolor: (theme) =>
            selected
              ? alpha(theme.palette.secondary.main, 0.125)
              : theme.palette.action.hover,
        },
        "&:hover .popperListingDragHandle": { opacity: linked ? 0 : 1 },
      }}
    >
      <Tooltip title={linked ? "" : dragS} arrow placement="left">
        <Box
          component="span"
          className="popperListingDragHandle"
          {...(linked ? {} : attributes)}
          {...(linked ? {} : listeners)}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
            color: "panel.iconMuted",
            cursor: linked ? "default" : "grab",
            touchAction: "none",
            opacity: isDragging ? 1 : 0,
            transition: "opacity 0.15s ease",
            "&:active": { cursor: linked ? "default" : "grabbing" },
          }}
        >
          <DragIndicator sx={{ fontSize: 16 }} />
        </Box>
      </Tooltip>

      <AvatarListing
        listing={listing}
        size={28}
        variant={variant}
        linked={linked}
      />

      <Typography
        variant="body2"
        noWrap
        sx={{
          flex: 1,
          minWidth: 0,
          fontWeight: selected ? 600 : 400,
          color: hidden ? "text.disabled" : "text.primary",
        }}
      >
        {listing.name ?? listing.label ?? "Liste"}
      </Typography>

      {linked && (
        <Tooltip
          title={sourceScopeName ? `${fromS} ${sourceScopeName}` : ""}
          arrow
        >
          <Chip
            label={sourceScopeName ?? "Lié"}
            size="small"
            sx={{
              height: 16,
              maxWidth: 90,
              flexShrink: 1,
              bgcolor: "listingFromOtherScope.main",
              color: "listingFromOtherScope.contrastText",
              "& .MuiChip-label": { px: 0.75, fontSize: "10px" },
            }}
          />
        </Tooltip>
      )}

      {/* "..." menu of the listing (rename, favorites, duplicate, delete —
          "Retirer du …" for a linked listing), same button as the active
          listing band. */}
      <Tooltip title={moreS} arrow placement="top">
        <Box
          component="button"
          onClick={(e) => onOpenMenu(e, listing)}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            p: 0,
            border: "none",
            borderRadius: 1.5,
            flexShrink: 0,
            cursor: "pointer",
            color: "text.secondary",
            bgcolor: "action.hover",
            "&:hover": { bgcolor: "action.selected" },
          }}
        >
          <MoreHoriz sx={{ fontSize: 16 }} />
        </Box>
      </Tooltip>

      {/* Annotations count pill = listing visibility toggle (same pill as
          the active listing band; filled in the accent when visible,
          outlined when hidden). */}
      <Tooltip title={hidden ? showS : hideS} arrow placement="top">
        <Box
          component="button"
          onClick={(e) => onToggleVisibility(e, listing.id)}
          sx={{
            minWidth: 24,
            height: 20,
            px: 0.75,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            borderRadius: 999,
            border: "1px solid",
            borderColor: hidden ? "panel.border" : "transparent",
            bgcolor: hidden ? "transparent" : accent,
            color: hidden ? "text.disabled" : "secondary.contrastText",
            cursor: "pointer",
            transition: "0.2s",
            "&:hover": {
              filter: "brightness(1.1)",
              borderColor: hidden ? "text.secondary" : "transparent",
            },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              fontFamily: "monospace",
              lineHeight: 1,
              color: "inherit",
            }}
          >
            {count}
          </Typography>
        </Box>
      </Tooltip>
    </ListItemButton>
  );
}

// -- Section --

export default function SectionPopperListings({
  listings,
  activeListing,
  countsByListingId,
  // Hosts where creating a listing is not allowed hide the empty-state CTA
  // (the "+" of the "Listes d'annotations" header is theirs to gate too).
  showAddListing = true,
}) {
  const dispatch = useDispatch();

  // strings

  const createListingS = "+ Liste de modèles d'annotations";
  const emptyS = "Aucune liste d'annotations.";

  // data

  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const selectListing = useSelectActiveListing(listings);
  const reorderListings = useReorderListings();
  const { isLinkedListing, getSourceScope } = useLinkedListings();

  // state

  // "..." menu: one menu for the section, anchored on the clicked row.
  const [menuState, setMenuState] = useState(null);
  const [openCreateListing, setOpenCreateListing] = useState(false);

  // helpers

  const hasNoListing = !listings?.length;
  const listingIds = (listings ?? []).map((l) => l.id);

  // helpers - drag & drop reorder

  const sensors = useSensors(
    // 5px activation distance keeps plain clicks (select / eye / "...")
    // working.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // handlers

  const handleSelectListing = (listing) => {
    selectListing(listing.id);
    dispatch(setSelectedItem({ id: listing.id, type: "LISTING" }));
  };

  const handleOpenMenu = (e, listing) => {
    e.stopPropagation();
    setMenuState({ anchorEl: e.currentTarget, listing });
  };

  const handleToggleVisibility = (e, listingId) => {
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

  const handleDragEnd = (event) => reorderListings(event, listings);

  // render

  if (hasNoListing) {
    return (
      <Box sx={{ px: 1.5, py: 1.5 }}>
        {showAddListing ? (
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            onClick={() => setOpenCreateListing(true)}
          >
            {createListingS}
          </Button>
        ) : (
          <Typography
            variant="body2"
            sx={{ color: "panel.textMuted", fontStyle: "italic" }}
          >
            {emptyS}
          </Typography>
        )}
        {openCreateListing && (
          <DialogChooseListingSource
            open={openCreateListing}
            onClose={() => setOpenCreateListing(false)}
          />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ py: 0.5 }}>
      <DndContext
        id="section-popper-listings-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={listingIds}
          strategy={verticalListSortingStrategy}
        >
          <List dense disablePadding>
            {listings.map((listing) => (
              <SortableRowPopperListing
                key={listing.id}
                listing={listing}
                selected={listing.id === activeListing?.id}
                hidden={hiddenListingsIds.includes(listing.id)}
                count={countsByListingId?.[listing.id] ?? 0}
                linked={isLinkedListing(listing.id)}
                sourceScopeName={getSourceScope(listing.id)?.name}
                onSelect={handleSelectListing}
                onToggleVisibility={handleToggleVisibility}
                onOpenMenu={handleOpenMenu}
              />
            ))}
          </List>
        </SortableContext>
      </DndContext>

      <MenuMoreActionsActiveListing
        anchorEl={menuState?.anchorEl ?? null}
        onClose={() => setMenuState(null)}
        listing={menuState?.listing ?? null}
      />

      {openCreateListing && (
        <DialogChooseListingSource
          open={openCreateListing}
          onClose={() => setOpenCreateListing(false)}
        />
      )}
    </Box>
  );
}
