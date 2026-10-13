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
import { ChipScopeStat } from "Features/dashboard/components/ChipsScopeStats";
import ListingFamilyAvatar from "./ListingFamilyAvatar";
import useLinkedListings from "Features/listings/hooks/useLinkedListings";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// One listing row of the SCOPE panel: drag handle, family mark (folder for a
// base map listing, initials avatar for an annotation listing — see
// ListingFamilyAvatar), name, and on the right the items count as a chip with
// the family icon (same chip as the dashboard scope rows) plus the row
// actions. `showVisibility` adds the eye — base map folders only: it hides
// the folder in the scope (scope.baseMapsSettings.disabledListingIds), and a
// hidden folder, its base maps and the annotations hosted on them are left
// out of every module. The eye is always shown (not just on hover): it is
// the one place where the scope's folders are hidden / revealed.
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
  familyType,
  familyIcon,
  showVisibility = false,
  onClick,
}) {
  // strings

  const dragS = "Glisser pour réordonner";
  const showS = "Afficher le dossier dans ce repérage";
  const hideS = "Masquer le dossier dans ce repérage";
  const fromS = "Depuis";

  // data

  const { disabledListingIds, toggleListingDisabled } =
    useDisabledBaseMapListingIds();

  // Listing linked from another scope ("Depuis un autre Krto"): read-only
  // reference row — not sortable, flagged in palette.listingFromOtherScope
  // with the source scope's name.
  const { isLinkedListing, getSourceScope } = useLinkedListings();
  const linked = isLinkedListing(listing.id);
  const sourceScopeName = linked ? getSourceScope(listing.id)?.name : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id, disabled: linked });

  // helpers

  const hidden = showVisibility && disabledListingIds.includes(listing.id);

  // Room the button keeps on the right for the actions overlay: count chip
  // and "⋮", plus the eye when the family has one.
  const actionsWidth = showVisibility ? 15 : 11;

  // handlers

  function handleToggleVisibility(e) {
    e.stopPropagation();
    toggleListingDisabled(listing.id);
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
      sx={(theme) => {
        const accent = linked
          ? theme.palette.listingFromOtherScope.main
          : theme.palette.secondary.main;
        return {
          // The tint lives on the row, not on the button: the drag handle and
          // the actions sit outside the button, and hovering them must still
          // light up the whole row.
          bgcolor: selected ? alpha(accent, 0.12) : "background.paper",
          "&:hover": {
            bgcolor: alpha(accent, selected ? 0.18 : 0.05),
          },
          // Selection also reads as a bar in the margin, so the eye finds the
          // current row down the edge. The border is always there,
          // transparent when unselected, so selecting never shifts the row. A
          // linked listing always shows its bar.
          borderLeft: "3px solid",
          borderLeftColor: linked || selected ? accent : "transparent",
          "&:hover .rowListingActions": { opacity: 1 },
          ...(!linked && { "&:hover .rowListingDragHandle": { opacity: 1 } }),
        };
      }}
    >
      <Tooltip title={linked ? "" : dragS}>
        <Box
          component="span"
          className="rowListingDragHandle"
          {...(linked ? {} : attributes)}
          {...(linked ? {} : listeners)}
          sx={{
            position: "absolute",
            left: 2,
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
          py: 1,
          pl: 3,
          pr: actionsWidth,
          gap: 1,
          // The row owns the background; without this the default hover would
          // darken the middle band again, on top of the row tint.
          "&:hover": { bgcolor: "transparent" },
        }}
      >
        <ListingFamilyAvatar
          listing={listing}
          familyType={familyType}
          familyIcon={familyIcon}
          selected={selected}
          hidden={hidden}
          linked={linked}
        />
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
        {linked && (
          <Tooltip title={sourceScopeName ? `${fromS} ${sourceScopeName}` : ""}>
            <Typography
              variant="caption"
              noWrap
              sx={{
                ml: 1,
                maxWidth: 90,
                color: "listingFromOtherScope.main",
                fontWeight: 600,
              }}
            >
              {sourceScopeName ?? fromS}
            </Typography>
          </Tooltip>
        )}
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
        {/* The eye is always visible: it is the scope's folder switch, not a
            hover action, and a hidden folder must read as such at a glance. */}
        {showVisibility && (
          <Tooltip title={hidden ? showS : hideS}>
            <IconButton
              size="small"
              onClick={handleToggleVisibility}
              sx={{ color: hidden ? "text.disabled" : "text.secondary" }}
            >
              {hidden ? (
                <VisibilityOff sx={{ fontSize: 16 }} />
              ) : (
                <Visibility sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
        <Box
          className="rowListingActions"
          sx={{
            display: "flex",
            alignItems: "center",
            pr: 0.5,
            opacity: 0,
            transition: "opacity 0.15s ease",
          }}
        >
          <IconButtonMoreActionsListing listing={listing} size="small" />
        </Box>

        {/* Item count — information, not an action: always visible, and outside
            the hover-revealed actions box. */}
        <ChipScopeStat
          icon={familyIcon ?? undefined}
          label={itemsCount ?? 0}
          sx={{ opacity: hidden ? 0.5 : 1 }}
        />
      </Box>
    </ListItem>
  );
}
