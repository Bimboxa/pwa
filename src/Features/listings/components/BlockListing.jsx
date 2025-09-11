import { Box, Typography } from "@mui/material";
import IconListingVariantBasic from "./IconListingVariantBasic";

export default function BlockListing({ listing }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <IconListingVariantBasic listing={listing} />
      <Typography sx={{ ml: 1 }}>{listing.name}</Typography>
    </Box>
  );
}
