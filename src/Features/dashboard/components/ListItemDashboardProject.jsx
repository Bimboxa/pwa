import {
  Box,
  Typography,
  ListItemButton,
  Chip,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { CloudQueue } from "@mui/icons-material";

import ChipProjectType from "./ChipProjectType";

export default function ListItemDashboardProject({
  item,
  selected,
  installing,
  onClick,
}) {
  // helpers

  const count = item.scopeCount ?? 0;
  const metaText = [item.clientRef, item.city].filter(Boolean).join(" · ");

  // render

  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        mb: 0.25,
        alignItems: "flex-start",
        "&.Mui-selected": {
          bgcolor: "white",
          boxShadow: (theme) => `inset 3px 0 0 ${theme.palette.secondary.main}`,
          "&:hover": { bgcolor: "white" },
        },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
            {item.name}
          </Typography>
          {!item.isLocal && !installing && (
            <Tooltip title="Projet non installé sur cet appareil">
              <CloudQueue
                sx={{ color: "text.secondary", fontSize: "1.05rem", flexShrink: 0 }}
              />
            </Tooltip>
          )}
          {installing && (
            <CircularProgress size={14} sx={{ color: "secondary.main" }} />
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
          <ChipProjectType type={item.type} />
          {metaText && (
            <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
              {metaText}
            </Typography>
          )}
        </Box>
      </Box>
      <Chip
        size="small"
        label={count}
        sx={{
          ml: 1,
          mt: 0.25,
          height: 22,
          minWidth: 22,
          fontWeight: 700,
          bgcolor: count ? "#efeff6" : "transparent",
          color: count ? "text.primary" : "#b8b8c8",
          border: count ? "none" : "1px dashed #d3d3e0",
        }}
      />
    </ListItemButton>
  );
}
