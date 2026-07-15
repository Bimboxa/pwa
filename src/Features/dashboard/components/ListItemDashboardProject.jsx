import {
  Box,
  Typography,
  ListItemButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CloudQueue } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ChipProjectType from "./ChipProjectType";

import {
  CARD_BORDER,
  TEXT_MUTED,
  TEXT_FADED,
  fadeUp,
} from "../utils/dashboardStyles";

export default function ListItemDashboardProject({
  item,
  index,
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

  // staggered entrance, capped so long lists don't wait
  const entranceDelay = 0.3 + Math.min(index ?? 0, 10) * 0.07;

  // render

  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        px: 2.5,
        py: 1.75,
        alignItems: "flex-start",
        bgcolor: "white",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "14px",
        mb: 1.25,
        transition: "all .18s",
        ...(index !== undefined && fadeUp(entranceDelay)),
        "&:hover": {
          bgcolor: "white",
          boxShadow: "0 6px 20px rgba(28,27,26,.10)",
          transform: "translateY(-2px)",
          borderColor: (theme) => alpha(theme.palette.secondary.main, 0.35),
        },
        "&.Mui-selected": {
          bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.06),
          borderColor: "secondary.main",
          "&:hover": {
            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.06),
          },
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
          color: count ? TEXT_MUTED : TEXT_FADED,
        }}
      >
        {countText}
      </Typography>
    </ListItemButton>
  );
}
