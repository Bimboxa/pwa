import { ListItemText, Menu, MenuItem, Typography } from "@mui/material";

import useScopeListingProcedures from "../hooks/useScopeListingProcedures";

// Menu of the "Dessin auto" procedures linked to the listings of the selected
// scope (one row per listing + procedure pair), opened above its anchor (the
// composer sits at the bottom of the info panel).
// `onChange({ listingId, procedureKey })`.
export default function MenuPickListingProcedure({
  open,
  anchorEl,
  onClose,
  onChange,
  emptyText,
}) {
  // data

  // read while closed too: the menu is positioned once, with its rows
  const items = useScopeListingProcedures();

  // render

  return (
    <Menu
      open={Boolean(open && anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "left" }}
      transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      slotProps={{ paper: { sx: { minWidth: 240, maxHeight: 360 } } }}
    >
      {items.length === 0 && (
        <Typography
          variant="body2"
          sx={{ px: 2, py: 1, color: "text.secondary" }}
        >
          {emptyText}
        </Typography>
      )}
      {items.map((item) => (
        <MenuItem
          key={`${item.listingId}:${item.procedureKey}`}
          dense
          onClick={() =>
            onChange({
              listingId: item.listingId,
              procedureKey: item.procedureKey,
            })
          }
        >
          <ListItemText
            primary={item.procedureLabel}
            secondary={item.listingName}
          />
        </MenuItem>
      ))}
    </Menu>
  );
}
