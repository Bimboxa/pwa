import { Typography, Box } from "@mui/material";

export default function HeaderListPanel({ title, actionComponent }) {
  return (
    <Box
      sx={{
        display: "flex",
        width: 1,
        alignItems: "center",
        justifyContent: "space-between",
        p: 2,
      }}
    >
      <Typography variant="h4">{title}</Typography>
      {actionComponent}
    </Box>
  );
}
