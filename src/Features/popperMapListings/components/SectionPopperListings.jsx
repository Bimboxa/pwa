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
import ButtonCountPill from "./ButtonCountPill";
import SoloIconToggle from "Features/mapEditor/components/SoloIconToggle";
import DialogChooseListingSource from "Features/listings/components/DialogChooseListingSource";
import MenuMoreActionsActiveListing from "Features/panelDrawing/components/MenuMoreActionsActiveListing";

import useLinkedListings from "Features/listings/hooks/useLinkedListings";
import useReorderListings from "Features/listings/hooks/useReorderListings";
import useSelectActiveListing from "Features/panelDrawing/hooks/useSelectActiveListing";

import activeListingCardSx from "../utils/activeListingCardSx";

// ---------------------------------------------------------------------------
// SectionPopperListings — listings panel of the Dessin popper, expanded from
// the "Listes" header above the active listing band:
// the annotation listings of the scope as vertical rows, in the selector's
// rank order. Each row: drag handle (reorder = rewrite the ranks, same rule
// as the LISTE ACTIVE menu), listing avatar, name, the "..." menu of the
// listing (rename, favorites, duplicate, delete — "Retirer du …" for a
// linked listing) and the annotations count (scoped like the popper) as a
// pill that toggles the listing visibility.
// Click = select the listing (active listing of the Dessin panel, the other
// listings keep their visibility) and send it to the selection as a LISTING
// item — the right panel, when open, shows its properties. The avatar is the
// listing SOLO toggle (same affordance as the template rows' icon): click =
// select the listing AND hide every other listing's annotations; ringed
// while the listing is the only visible one. With no listing at all, the
// section is the create CTA.
// ---------------------------------------------------------------------------

// -- Sortable row --

function SortableRowPopperListing({
  listing,
  selected,
  hidden,
  // Selected and every other listing of the panel hidden.
  soloed,
  count,
  // Listing linked from another scope ("Depuis un autre Krto"): selectable,
  // not sortable, flagged in the linked colour with the source scope's name.
  linked = false,
  sourceScopeName,
  onSelect,
  onSolo,
  onToggleVisibility,
  onOpenMenu,
}) {
  // strings

  const dragS = "Glisser pour réordonner";
  const soloS = "Masquer les autres annotations";
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

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const accent = linked ? "listingFromOtherScope.main" : "secondary.main";
  const accentKey = linked ? "listingFromOtherScope" : "secondary";
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.8 : 1,
      }}
      sx={{
        gap: 1,
        // Every row has the same inset and radius, so selecting never
        // shifts a row: the selected one is the white accent-flagged card
        // (activeListingCardSx, same look as the templates card below the
        // listings), the others sit flat on the grey panel.
        mx: 1,
        pl: 0.5,
        pr: 1,
        py: 0.5,
        borderRadius: 2,
        // Selection flag: left border, always there so selecting never
        // shifts the row; a linked listing always shows its bar.
        borderLeft: "3px solid",
        borderLeftColor: linked || selected ? accent : "transparent",
        bgcolor: "transparent",
        ...(selected && activeListingCardSx(accent)),
        "&:hover": {
          bgcolor: (theme) =>
            selected
              ? alpha(theme.palette[accentKey].main, 0.06)
              : theme.palette.action.hover,
        },
        // Keyboard focus (or a focused child button) must not grey the
        // row: the selected card stays white.
        "&.Mui-focusVisible": {
          bgcolor: selected ? "background.paper" : "transparent",
        },
        "&:hover .popperListingDragHandle": { opacity: linked ? 0 : 1 },
        "& .popperListingDragHandle": { opacity: linked ? 0 : 1 },
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
            // Always shown (a linked listing is not sortable: no handle).
            opacity: linked ? 0 : 1,
            "&:active": { cursor: linked ? "default" : "grabbing" },
          }}
        >
          <DragIndicator sx={{ fontSize: 16 }} />
        </Box>
      </Tooltip>

      {/* Avatar = listing SOLO toggle (button shape on row hover, ring
          while the listing is the only visible one). */}
      <SoloIconToggle
        isSolo={soloed}
        isRowHovered={isHovered}
        onToggle={() => onSolo(listing)}
        title={soloS}
        size={32}
      >
        <AvatarListing
          listing={listing}
          size={28}
          variant={variant}
          linked={linked}
        />
      </SoloIconToggle>

      <Typography
        variant="body2"
        noWrap
        sx={{
          flex: 1,
          minWidth: 0,
          // Selected row: same style as the collapsed active listing band
          // (bold, secondary).
          fontWeight: selected ? 700 : 400,
          color: hidden
            ? "text.disabled"
            : selected
              ? "secondary.main"
              : "text.primary",
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
          listing band. Selected row only — kept in the layout, invisible,
          on the other rows so every count pill stays aligned. */}
      <Tooltip title={selected ? moreS : ""} arrow placement="top">
        <Box
          component="button"
          onClick={(e) => onOpenMenu(e, listing)}
          tabIndex={selected ? 0 : -1}
          aria-hidden={!selected}
          sx={{
            visibility: selected ? "visible" : "hidden",
            pointerEvents: selected ? "auto" : "none",
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
          the active listing band). */}
      <ButtonCountPill
        count={count}
        hidden={hidden}
        title={hidden ? showS : hideS}
        onClick={(e) => onToggleVisibility(e, listing.id)}
        accent={accent}
      />
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

  // Row click: the other listings keep their visibility.
  const handleSelectListing = (listing) => {
    selectListing(listing.id, { hideOthers: false });
    dispatch(setSelectedItem({ id: listing.id, type: "LISTING" }));
  };

  // Avatar click: select AND hide every other listing of the panel.
  const handleSoloListing = (listing) => {
    selectListing(listing.id, { hideOthers: true });
    dispatch(setSelectedItem({ id: listing.id, type: "LISTING" }));
  };

  const isSoloed = (listing) =>
    listing.id === activeListing?.id &&
    listingIds
      .filter((id) => id !== listing.id)
      .every((id) => hiddenListingsIds.includes(id));

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
                soloed={isSoloed(listing)}
                count={countsByListingId?.[listing.id] ?? 0}
                linked={isLinkedListing(listing.id)}
                sourceScopeName={getSourceScope(listing.id)?.name}
                onSelect={handleSelectListing}
                onSolo={handleSoloListing}
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
