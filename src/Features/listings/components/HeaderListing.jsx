import { Box, Typography } from "@mui/material";
import theme from "Styles/theme";

export default function HeaderListing({ listing }) {
  // helpers

  const color = listing?.color;

  // render

  return (
    <Box sx={{ p: 1, bgcolor: "white" }}>
      <Typography>{listing?.name}</Typography>
    </Box>
  );
}
