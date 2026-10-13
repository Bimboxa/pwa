import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setAutoListingVisibility } from "Features/panelDrawing/panelDrawingSlice";

import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import DragIndicator from "@mui/icons-material/DragIndicator";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

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
import RowPanelOptionCheckbox from "Features/layout/components/RowPanelOptionCheckbox";

import useLinkedListings from "Features/listings/hooks/useLinkedListings";
import useReorderListings from "Features/listings/hooks/useReorderListings";
import useSelectActiveListing from "Features/panelDrawing/hooks/useSelectActiveListing";

// ---------------------------------------------------------------------------
// SectionPopperListings — "Listes" side of PopperMapListings (Dessin module):
// the annotation listings of the scope as vertical rows, in the selector's
// rank order. Each row: drag handle (reorder = rewrite the ranks, same rule
// as the LISTE ACTIVE menu), listing avatar, name, annotations count (scoped
// like the popper), visibility eye and the "..." menu of the listing (rename,
// favorites, duplicate, delete — "Retirer du …" for a linked listing).
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
  const showS = "Afficher";
  const hideS = "Masquer";
  const moreS = "Actions sur la liste";
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

      {/* Annotations count, scoped like the popper. */}
      <Chip
        label={count}
        size="small"
        sx={{
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
                ? accent
                : "panel.countEmpty",
          },
        }}
      />

      <Tooltip title={hidden ? showS : hideS} arrow>
        <IconButton
          size="small"
          onClick={(e) => onToggleVisibility(e, listing.id)}
          sx={{
            p: 0.5,
            flexShrink: 0,
            color: hidden ? accent : "panel.iconMuted",
          }}
        >
          {hidden ? (
            <VisibilityOff sx={{ fontSize: 16 }} />
          ) : (
            <Visibility sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Tooltip>

      <Tooltip title={moreS} arrow>
        <IconButton
          size="small"
          onClick={(e) => onOpenMenu(e, listing)}
          sx={{ p: 0.5, flexShrink: 0, color: "panel.iconMuted" }}
        >
          <MoreHoriz sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </ListItemButton>
  );
}

// -- Section --

export default function SectionPopperListings({
  listings,
  activeListing,
  countsByListingId,
  // Hosts where creating a listing is not allowed hide the "Nouvelle liste"
  // row and the empty-state CTA.
  showAddListing = true,
}) {
  const dispatch = useDispatch();

  // strings

  const addListingS = "Nouvelle liste";
  const createListingS = "+ Liste de modèles d'annotations";
  const emptyS = "Aucune liste d'annotations.";
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

  const handleOpenMenu = (e, listing) => {
    e.stopPropagation();
    setMenuState({ anchorEl: e.currentTarget, listing });
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

      {showAddListing && (
        <ListItemButton
          onClick={() => setOpenCreateListing(true)}
          sx={{
            gap: 1,
            pl: 0.5,
            pr: 1,
            py: 0.5,
            // Same left structure as the rows (transparent selection border
            // + drag handle slot) so the "+" lines up with the avatars.
            borderLeft: "3px solid transparent",
          }}
        >
          <Box
            component="span"
            sx={{ width: 16, flexShrink: 0, display: "inline-flex" }}
          />
          <Box
            sx={{
              width: 28,
              height: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: "1px dashed",
              borderColor: "panel.textLight",
              color: "panel.textMuted",
              flexShrink: 0,
            }}
          >
            <Add sx={{ fontSize: 16 }} />
          </Box>
          <Typography variant="body2" color="panel.textMuted">
            {addListingS}
          </Typography>
        </ListItemButton>
      )}

      {/* "Visibilité auto": selecting a listing hides every other listing
          and unhides all the templates of the selected one (same option as
          the LISTE ACTIVE menu — panelDrawing.autoListingVisibility). */}
      <Divider sx={{ mt: 0.5 }} />
      <RowPanelOptionCheckbox
        label={autoVisibilityS}
        tooltip={autoVisibilityTooltipS}
        checked={autoVisibility}
        onChange={(checked) => dispatch(setAutoListingVisibility(checked))}
      />

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
