import { Box, Typography, IconButton } from "@mui/material";
import { SwapHoriz } from "@mui/icons-material";

import IconListingVariantBasic from "Features/listings/components/IconListingVariantBasic";

export default function HeaderListingViewerPanel({
  listing,
  title,
  showIcon = true,
  showSwap = true,
  onSelectListing,
}) {
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
        {showIcon && listing && <IconListingVariantBasic listing={listing} />}
        <Typography noWrap sx={{ ml: showIcon && listing ? 1 : 0, fontWeight: "bold" }}>
          {title}
        </Typography>
      </Box>
      {showSwap && (
        <IconButton size="small" onClick={onSelectListing}>
          <SwapHoriz />
        </IconButton>
      )}
    </Box>
  );
}
