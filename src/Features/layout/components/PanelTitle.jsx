import { Box, Typography } from "@mui/material";

export default function PanelTitle({ title }) {
  return (
    <Box sx={{ p: 1 }}>
      <Typography sx={{ fontWeight: "bold" }}>{title}</Typography>
    </Box>
  );
}
