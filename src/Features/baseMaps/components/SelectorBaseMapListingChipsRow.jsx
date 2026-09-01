import { useState } from "react";

import { Box, Chip, Menu, MenuItem } from "@mui/material";
import { alpha } from "@mui/material/styles";

const MAX_VISIBLE = 4;

export default function SelectorBaseMapListingChipsRow({
  listings,
  selectedListingId,
  onSelect,
}) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const _listings = listings ?? [];

  let visible = _listings.slice(0, MAX_VISIBLE);
  const selectedIsHidden =
    selectedListingId &&
    _listings.some((l) => l.id === selectedListingId) &&
    !visible.some((l) => l.id === selectedListingId);
  if (selectedIsHidden) {
    const selected = _listings.find((l) => l.id === selectedListingId);
    visible = [...visible.slice(0, MAX_VISIBLE - 1), selected];
  }

  const hidden = _listings.filter(
    (l) => !visible.some((v) => v.id === l.id)
  );

  const moreLabel = `${hidden.length} autre${hidden.length > 1 ? "s" : ""}`;

  const selectedSx = {
    bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
    color: "secondary.main",
    fontWeight: 500,
    border: "1px solid",
    borderColor: (theme) => alpha(theme.palette.secondary.main, 0.5),
    "&:hover": {
      bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.2),
    },
  };

  // handlers

  function handleChipClick(listingId) {
    onSelect(listingId);
  }

  function handleMenuItemClick(listingId) {
    setAnchorEl(null);
    onSelect(listingId);
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
      }}
    >
      {visible.map((listing) => {
        const selected = listing.id === selectedListingId;
        return (
          <Chip
            key={listing.id}
            label={listing.name}
            size="small"
            clickable
            variant={selected ? "filled" : "outlined"}
            onClick={() => handleChipClick(listing.id)}
            sx={selected ? selectedSx : { color: "text.secondary" }}
          />
        );
      })}

      {hidden.length > 0 && (
        <>
          <Chip
            label={moreLabel}
            size="small"
            clickable
            variant="outlined"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ color: "text.secondary", borderStyle: "dashed" }}
          />
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            {hidden.map((listing) => (
              <MenuItem
                key={listing.id}
                onClick={() => handleMenuItemClick(listing.id)}
              >
                {listing.name}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
}
