import { Box, Typography } from "@mui/material";

import IconButtonMoreListingV2 from "./IconButtonMoreListingV2";
import IconListingVariantBasic from "./IconListingVariantBasic";

export default function HeaderListing({ listing }) {
  // helpers

  const color = listing?.color;

  // render

  return (
    <Box
      sx={{
        p: 1,
        bgcolor: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <IconListingVariantBasic listing={listing} />
        <Typography sx={{ ml: 1, fontWeight: "bold" }}>
          {listing?.name}
        </Typography>
      </Box>
      <IconButtonMoreListingV2 listing={listing} />
    </Box>
  );
}
