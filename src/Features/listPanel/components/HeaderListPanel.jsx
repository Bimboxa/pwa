import { Typography, Box } from "@mui/material";

export default function HeaderListPanel({ title, actionComponent }) {
  return (
    <Box
      sx={{
        display: "flex",
        width: 1,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Typography variant="h4" sx={{ p: 2 }}>
        {title}
      </Typography>
      {actionComponent}
    </Box>
  );
}
