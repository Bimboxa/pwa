import { Box } from "@mui/material";

export default function BoxAlignToRight({ children }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>{children}</Box>
  );
}
