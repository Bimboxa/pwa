import { useState } from "react";
import { useDispatch } from "react-redux";

import { setSelectedListingId } from "../businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  Button,
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
import ButtonCountPill from "Features/popperMapListings/components/ButtonCountPill";
import DialogCreateBusinessObjectListing from "./DialogCreateBusinessObjectListing";
import MenuMoreActionsBusinessObjectListing from "./MenuMoreActionsBusinessObjectListing";

import useBusinessObjectType from "../hooks/useBusinessObjectType";
import useReorderBusinessObjectListings from "../hooks/useReorderBusinessObjectListings";

import activeListingCardSx from "Features/popperMapListings/utils/activeListingCardSx";

// ---------------------------------------------------------------------------
// SectionBusinessObjectListings — listings panel of a business-objects
// module, expanded from the header of BandActiveBusinessObjectListing
// (transposition of the Dessin SectionPopperListings): the module's listings
// as vertical rows in rank order. Each row: drag handle (reorder = rewrite
// the ranks), listing avatar, name, the "..." menu of the listing (rename,
// renumber, delete — selected row only) and the objects count pill (a plain
// figure: business-object listings have no visibility toggle).
// Click = select the listing (active listing of the module) and send it to
// the selection as a LISTING item — the right panel, when open, shows its
// properties. With no listing at all, the section is the create CTA.
// ---------------------------------------------------------------------------

// -- Sortable row --

function SortableRowBusinessObjectListing({
  listing,
  selected,
  count,
  onSelect,
  onOpenMenu,
}) {
  // strings

  const dragS = "Glisser pour réordonner";
  const moreS = "Actions sur la liste";

  // data

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id });

  // helpers

  const accent = "secondary.main";
  const variant = selected ? "selected" : count ? "visible" : "muted";

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
        // Same inset and radius on every row, so selecting never shifts a
        // row: the selected one is the white accent-flagged card
        // (activeListingCardSx, same look as the objects card below), the
        // others sit flat on the grey panel.
        mx: 1,
        pl: 0.5,
        pr: 1,
        py: 0.5,
        borderRadius: 2,
        borderLeft: "3px solid",
        borderLeftColor: selected ? accent : "transparent",
        bgcolor: "transparent",
        ...(selected && activeListingCardSx(accent)),
        "&:hover": {
          bgcolor: (theme) =>
            selected
              ? alpha(theme.palette.secondary.main, 0.06)
              : theme.palette.action.hover,
        },
        // Keyboard focus (or a focused child button) must not grey the
        // row: the selected card stays white.
        "&.Mui-focusVisible": {
          bgcolor: selected ? "background.paper" : "transparent",
        },
      }}
    >
      <Tooltip title={dragS} arrow placement="left">
        <Box
          component="span"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
            color: "panel.iconMuted",
            cursor: "grab",
            touchAction: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <DragIndicator sx={{ fontSize: 16 }} />
        </Box>
      </Tooltip>

      <AvatarListing listing={listing} size={28} variant={variant} />

      <Typography
        variant="body2"
        noWrap
        sx={{
          flex: 1,
          minWidth: 0,
          // Selected row: same style as the collapsed active listing band
          // (bold, secondary).
          fontWeight: selected ? 700 : 400,
          color: selected ? accent : "text.primary",
        }}
      >
        {listing.name ?? listing.label ?? "Liste"}
      </Typography>

      {/* "..." menu of the listing, same button as the active listing band.
          Selected row only — kept in the layout, invisible, on the other
          rows so every count pill stays aligned. */}
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

      <ButtonCountPill count={count} accent={accent} />
    </ListItemButton>
  );
}

// -- Section --

export default function SectionBusinessObjectListings({
  typeKey,
  listings,
  activeListing,
  countsByListingId,
}) {
  const dispatch = useDispatch();

  // data — type of the module (the module IS the type): wording of the
  // creation button, resolved for the org

  const moduleType = useBusinessObjectType(typeKey ?? undefined);

  // strings

  const createListingS = moduleType.strings.createListing;

  // data

  const reorderListings = useReorderBusinessObjectListings();

  // state

  // "..." menu: one menu for the section, anchored on the clicked row.
  const [menuState, setMenuState] = useState(null);
  const [openCreateListing, setOpenCreateListing] = useState(false);

  // helpers

  const hasNoListing = !listings?.length;
  const listingIds = (listings ?? []).map((l) => l.id);

  // helpers - drag & drop reorder

  const sensors = useSensors(
    // 5px activation distance keeps plain clicks (select / "...") working.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // handlers

  const handleSelectListing = (listing) => {
    dispatch(setSelectedListingId(listing.id));
    // The properties panel follows the active listing: any object / work
    // package selection of the previous listing is stale. The right panel is
    // not force-opened (changing list must not pop it up).
    dispatch(
      setSelectedItem({
        id: listing.id,
        type: "LISTING",
        listingId: listing.id,
      })
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
        <Button
          fullWidth
          variant="contained"
          color="secondary"
          onClick={() => setOpenCreateListing(true)}
        >
          {createListingS}
        </Button>
        {openCreateListing && (
          <DialogCreateBusinessObjectListing
            open
            onClose={() => setOpenCreateListing(false)}
          />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ py: 0.5 }}>
      <DndContext
        id="section-business-object-listings-dnd"
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
              <SortableRowBusinessObjectListing
                key={listing.id}
                listing={listing}
                selected={listing.id === activeListing?.id}
                count={countsByListingId?.[listing.id] ?? 0}
                onSelect={handleSelectListing}
                onOpenMenu={handleOpenMenu}
              />
            ))}
          </List>
        </SortableContext>
      </DndContext>

      <MenuMoreActionsBusinessObjectListing
        anchorEl={menuState?.anchorEl ?? null}
        onClose={() => setMenuState(null)}
        listing={menuState?.listing ?? null}
      />
    </Box>
  );
}
