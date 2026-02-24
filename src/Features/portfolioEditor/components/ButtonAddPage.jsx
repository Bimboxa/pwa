import { Box, Typography } from "@mui/material";

export default function ButtonAddPage({ onClick }) {
  // render

  return (
    <Box
      onClick={onClick}
      sx={{
        width: 200,
        py: 1,
        border: "2px dashed",
        borderColor: "divider",
        borderRadius: 1,
        cursor: "pointer",
        textAlign: "center",
        "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
      }}
    >
      <Typography variant="body2" color="text.secondary">
        + page
      </Typography>
    </Box>
  );
}
