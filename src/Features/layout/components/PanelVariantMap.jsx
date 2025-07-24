import { Box, Paper } from "@mui/material";

export default function PanelVariantMap({ children }) {
  return (
    <Paper
      elevation={6}
      sx={{
        width: 1,
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {children}
    </Paper>
  );
}
