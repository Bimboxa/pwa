import { useDispatch, useSelector } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";

import {
  Box,
  IconButton,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import DragIndicator from "@mui/icons-material/DragIndicator";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import IconButtonMoreActionsListing from "Features/listings/components/IconButtonMoreActionsListing";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// One listing row of the SCOPE panel: drag handle, name, and the row actions
// on the right. `showVisibility` adds the eye — base map folders only, where
// it hides that folder's plans from the recap editor.
export default function RowListingInGroup({
  listing,
  selected,
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
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.8 : 1,
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderBottomColor: "divider",
        // Selection reads as a bar in the margin, not a filled row: the rows
        // stay legible and the eye finds the current one down the edge. The
        // border is always there, transparent when unselected, so selecting
        // never shifts the row.
        borderLeft: "3px solid",
        borderLeftColor: selected ? "secondary.main" : "transparent",
        "&:hover .rowListingActions": { opacity: 1 },
      }}
    >
      <Tooltip title={dragS}>
        <Box
          component="span"
          {...attributes}
          {...listeners}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
            pl: 0.5,
            color: "text.disabled",
            cursor: "grab",
            touchAction: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <DragIndicator sx={{ fontSize: 18 }} />
        </Box>
      </Tooltip>

      <ListItemButton
        onClick={() => onClick(listing)}
        sx={{ flex: 1, minWidth: 0, py: 1.25, px: 1 }}
      >
        <Typography variant="body2" noWrap sx={{ opacity: hidden ? 0.5 : 1 }}>
          {listing?.name}
        </Typography>
      </ListItemButton>

      <Box
        className="rowListingActions"
        sx={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
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
    </Box>
  );
}
