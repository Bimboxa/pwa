import {
  Box,
  Typography,
  ListItemButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { CloudQueue } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ChipProjectType from "./ChipProjectType";

export default function ListItemDashboardProject({
  item,
  selected,
  installing,
  onClick,
}) {
  // data

  const appConfig = useAppConfig();

  // helpers

  const krtoS = appConfig?.strings?.scope?.nameSingular ?? "Krto";

  const count = item.scopeCount ?? 0;
  const countText =
    count === 0 ? `Aucun ${krtoS}` : `${count} ${krtoS}${count > 1 ? "s" : ""}`;

  const metaText = [item.clientRef, item.city].filter(Boolean).join(" · ");

  // render

  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 1.25,
        alignItems: "flex-start",
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderBottom: "none" },
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
      <Typography
        variant="caption"
        sx={{
          ml: 1,
          mt: 0.25,
          flexShrink: 0,
          color: count ? "text.secondary" : "#b8b8c8",
        }}
      >
        {countText}
      </Typography>
    </ListItemButton>
  );
}
