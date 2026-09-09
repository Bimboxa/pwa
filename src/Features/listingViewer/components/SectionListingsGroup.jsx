import { Box, Typography } from "@mui/material";

import ListListings from "Features/listings/components/ListListings";

// One entityModel-type section of the "Objets" module panel: the type label
// over the listings of that type. Creation is panel-level (the "+" beside the
// panel title), so a section carries no action of its own.
export default function SectionListingsGroup({
  group,
  selection,
  onListingClick,
  onSeeObjects,
}) {
  // render

  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          px: 2,
          pt: 1.5,
          pb: 0.5,
          color: "text.secondary",
          textTransform: "uppercase",
          fontWeight: 600,
          letterSpacing: 0.5,
        }}
      >
        {group.label}
      </Typography>

      <Box sx={{ bgcolor: "white" }}>
        <ListListings
          listings={group.listings}
          onClick={onListingClick}
          onSeeObjects={onSeeObjects}
          selection={selection}
        />
      </Box>
    </Box>
  );
}
