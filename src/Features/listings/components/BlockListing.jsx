import { Box, Typography } from "@mui/material";
import IconListingVariantBasic from "./IconListingVariantBasic";

export default function BlockListing({ listing }) {
  const listingS = "Module";

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <IconListingVariantBasic listing={listing} size={32} />
      <Box sx={{ ml: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {listingS}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: "bold", mt: -0.5 }}>
          {listing?.name}
        </Typography>
      </Box>
    </Box>
  );
}
