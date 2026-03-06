import { Box, Typography, IconButton } from "@mui/material";
import { SwapHoriz } from "@mui/icons-material";

import IconListingVariantBasic from "Features/listings/components/IconListingVariantBasic";

export default function HeaderListingViewerPanel({ listing, onSelectListing }) {
  // render

  return (
    <Box
      sx={{
        p: 1,
        bgcolor: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
        {listing && <IconListingVariantBasic listing={listing} />}
        <Typography noWrap sx={{ ml: 1, fontWeight: "bold" }}>
          {listing?.name || "Listing"}
        </Typography>
      </Box>
      <IconButton size="small" onClick={onSelectListing}>
        <SwapHoriz />
      </IconButton>
    </Box>
  );
}
