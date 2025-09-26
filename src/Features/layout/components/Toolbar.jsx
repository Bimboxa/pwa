import { Paper } from "@mui/material";

export default function Toolbar({ children, sx }) {
  return (
    <Paper
      sx={{
        display: "flex",
        alignItems: "center",
        bgcolor: "grey.800",
        color: "white",
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
