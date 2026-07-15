import { Box, Typography } from "@mui/material";

// One row of the "daily scopes" list: project name over scope name on the
// left, author trigram over creation time on the right.

export default function ListItemDailyScope({ item }) {
  // helpers

  const timeS = item.lastConfigurationAt
    ? new Date(item.lastConfigurationAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "white",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
          {item.projectName}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
          {item.scopeName}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
          {item.createdBy?.trigram}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {timeS}
        </Typography>
      </Box>
    </Box>
  );
}
