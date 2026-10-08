import { Box, ListItem, ListItemButton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { ChipScopeStat } from "Features/dashboard/components/ChipsScopeStats";
import ListingFamilyAvatar from "./ListingFamilyAvatar";

// "Afficher toutes les listes" row, at the top of the annotation listings
// group of the SCOPE panel: puts the recap editor on the whole scope (every
// base map, the annotations of every listing). Same look as a listing row
// (RowListingInGroup: tint, left bar, family mark, count chip) without what
// does not apply to it — no drag handle (it is pinned above the sortable
// rows), no eye, no "⋮" actions. The count is the total of the annotation
// listings the editor displays in that mode.
export default function RowAllListingsInGroup({
  selected,
  itemsCount,
  familyIcon,
  onClick,
}) {
  // strings

  const label = "Afficher toutes les listes";

  // render

  return (
    <ListItem
      disablePadding
      divider
      sx={(theme) => {
        const accent = theme.palette.secondary.main;
        return {
          bgcolor: selected ? alpha(accent, 0.12) : "background.paper",
          "&:hover": {
            bgcolor: alpha(accent, selected ? 0.18 : 0.05),
          },
          borderLeft: "3px solid",
          borderLeftColor: selected ? accent : "transparent",
        };
      }}
    >
      <ListItemButton
        onClick={onClick}
        sx={{
          py: 1,
          pl: 3,
          // Room for the count chip laid over the right edge, like the
          // listing rows.
          pr: 11,
          gap: 1,
          "&:hover": { bgcolor: "transparent" },
        }}
      >
        <ListingFamilyAvatar
          familyType={null}
          familyIcon={familyIcon}
          selected={selected}
        />
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontWeight: selected ? 700 : 400 }}
        >
          {label}
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
        <ChipScopeStat icon={familyIcon ?? undefined} label={itemsCount ?? 0} />
      </Box>
    </ListItem>
  );
}
