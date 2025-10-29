import { Box } from "@mui/material";

export default function BoxAlignToRight({ children, sx }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", ...sx }}>
      {children}
    </Box>
  );
}
