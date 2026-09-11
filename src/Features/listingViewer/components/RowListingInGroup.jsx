import { useDispatch, useSelector } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";

import {
  Box,
  IconButton,
  ListItem,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DragIndicator from "@mui/icons-material/DragIndicator";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import IconButtonMoreActionsListing from "Features/listings/components/IconButtonMoreActionsListing";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// One listing row of the SCOPE panel: drag handle, name, and the row actions
// on the right. `showVisibility` adds the eye — base map folders only, where
// it hides that folder's plans from the recap editor.
//
// The drag handle and the actions are laid over the row, not beside it, so the
// ListItemButton spans the whole width and the hover / selection tint reaches
// both edges. Laying the three zones out side by side tints the middle band
// only, which is what this row used to do.
//
// The overlays are positioned by hand rather than through the `secondaryAction`
// prop: that prop makes ListItem force `padding-right: 48px` on its child
// button through a two-class selector, which outranks the button's own sx. The
// actions here are wider than 48px, so the name would run under them.
export default function RowListingInGroup({
  listing,
  selected,
  itemsCount,
  showVisibility = false,
  onClick,
}) {
  const dispatch = useDispatch();

  // strings

  const dragS = "Glisser pour réordonner";
  const showS = "Afficher";
  const hideS = "Masquer";

  // data

  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id });

  // helpers

  const hidden = hiddenListingsIds.includes(listing.id);

  // Room the button keeps on the right for the actions overlay: count and
  // "⋮", plus the eye when the family has one.
  const actionsWidth = showVisibility ? 12 : 8;

  // handlers

  function handleToggleVisibility(e) {
    e.stopPropagation();
    dispatch(
      setHiddenListingsIds(
        hidden
          ? hiddenListingsIds.filter((id) => id !== listing.id)
          : [...hiddenListingsIds, listing.id]
      )
    );
  }

  // render

  return (
    <ListItem
      ref={setNodeRef}
      disablePadding
      divider
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.8 : 1,
      }}
      sx={(theme) => ({
        // The tint lives on the row, not on the button: the drag handle and the
        // actions sit outside the button, and hovering them must still light up
        // the whole row.
        bgcolor: selected
          ? alpha(theme.palette.secondary.main, 0.12)
          : "background.paper",
        "&:hover": {
          bgcolor: alpha(theme.palette.secondary.main, selected ? 0.18 : 0.05),
        },
        // Selection also reads as a bar in the margin, so the eye finds the
        // current row down the edge. The border is always there, transparent
        // when unselected, so selecting never shifts the row.
        borderLeft: "3px solid",
        borderLeftColor: selected ? "secondary.main" : "transparent",
        "&:hover .rowListingActions, &:hover .rowListingDragHandle": {
          opacity: 1,
        },
      })}
    >
      <Tooltip title={dragS}>
        <Box
          component="span"
          className="rowListingDragHandle"
          {...attributes}
          {...listeners}
          sx={{
            position: "absolute",
            left: 4,
            top: 0,
            bottom: 0,
            zIndex: 1,
            display: "inline-flex",
            alignItems: "center",
            color: "text.disabled",
            cursor: "grab",
            touchAction: "none",
            // Revealed on row hover like the actions; the button reserves the
            // space below, so the name never shifts.
            opacity: isDragging ? 1 : 0,
            transition: "opacity 0.15s ease",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <DragIndicator sx={{ fontSize: 18 }} />
        </Box>
      </Tooltip>

      <ListItemButton
        onClick={() => onClick(listing)}
        sx={{
          py: 1.25,
          pl: 3.75,
          pr: actionsWidth,
          // The row owns the background; without this the default hover would
          // darken the middle band again, on top of the row tint.
          "&:hover": { bgcolor: "transparent" },
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            opacity: hidden ? 0.5 : 1,
            fontWeight: selected ? 700 : 400,
          }}
        >
          {listing?.name}
        </Typography>
      </ListItemButton>

      <Box
        sx={{
          position: "absolute",
          right: 8,
          top: 0,
          bottom: 0,
          zIndex: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box
          className="rowListingActions"
          sx={{
            display: "flex",
            alignItems: "center",
            pr: 0.5,
            // The eye stays visible once off, so a hidden folder is readable
            // without hovering every row.
            opacity: hidden ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}
        >
          {showVisibility && (
            <Tooltip title={hidden ? showS : hideS}>
              <IconButton size="small" onClick={handleToggleVisibility}>
                {hidden ? (
                  <VisibilityOff sx={{ fontSize: 16 }} />
                ) : (
                  <Visibility sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          )}
          <IconButtonMoreActionsListing listing={listing} size="small" />
        </Box>

        {/* Item count — information, not an action: always visible, and outside
            the hover-revealed actions box. */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            minWidth: 20,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {itemsCount ?? ""}
        </Typography>
      </Box>
    </ListItem>
  );
}
