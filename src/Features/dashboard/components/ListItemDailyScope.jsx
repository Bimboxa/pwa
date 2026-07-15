import { Box, Typography, Button } from "@mui/material";

import parseBackendDate from "Features/date/utils/parseBackendDate";

import { TEXT_FAINT } from "../utils/dashboardStyles";

// One row of the "daily scopes" list: project name over scope name on the
// left, author trigram + creation time on one line over an "open" button on
// the right.

export default function ListItemDailyScope({ item, onOpen }) {
  // strings

  const openS = "Ouvrir";

  // helpers

  const timeS =
    parseBackendDate(item.lastConfigurationAt)?.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }) ?? "";

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
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 0.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
            {item.createdBy?.trigram}
          </Typography>
          <Typography variant="caption" sx={{ color: TEXT_FAINT }}>
            {timeS}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onOpen?.(item)}
          sx={{ fontSize: 12, py: 0, px: 1.25, minWidth: 0 }}
        >
          {openS}
        </Button>
      </Box>
    </Box>
  );
}
