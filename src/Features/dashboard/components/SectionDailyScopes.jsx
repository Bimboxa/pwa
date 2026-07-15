import { useMemo } from "react";

import { useTheme } from "@mui/material/styles";
import { Box, Typography, Chip } from "@mui/material";
import { EventAvailable, EventNote } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDailyScopes from "Features/dailyScopes/hooks/useDailyScopes";

import CardEmptySection from "./CardEmptySection";
import ListItemDailyScope from "./ListItemDailyScope";

import {
  SEGMENT_BG,
  TEXT_MUTED,
  TEXT_FAINT,
  fadeUp,
} from "../utils/dashboardStyles";

export default function SectionDailyScopes() {
  const theme = useTheme();

  // data

  const appConfig = useAppConfig();
  const { dailyScopes } = useDailyScopes();

  // items — most recent first

  const items = useMemo(() => {
    return [...(dailyScopes ?? [])].sort(
      (a, b) =>
        new Date(b.lastConfigurationAt ?? 0) -
        new Date(a.lastConfigurationAt ?? 0)
    );
  }, [dailyScopes]);

  // strings

  const titleS = appConfig?.strings?.scope?.dailyScope ?? "Repérages du jour";
  const emptyTitleS =
    appConfig?.strings?.scope?.dailyScopeEmptyTitle ?? "Rien pour aujourd'hui";
  const emptyHintS =
    appConfig?.strings?.scope?.dailyScopeEmptyHint ??
    "Les repérages que vous ouvrez ou modifiez aujourd'hui apparaîtront ici pour un suivi rapide.";
  const comingSoonS = appConfig?.strings?.general?.comingSoon ?? "Prochainement";

  // helpers

  const accentColor = theme.palette.secondary.main;

  const dateS = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dateLabel = dateS.charAt(0).toUpperCase() + dateS.slice(1);

  // render

  return (
    <Box sx={{ mt: 6, ...fadeUp(0.35) }}>
      {/* header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <EventAvailable sx={{ color: accentColor, fontSize: 22 }} />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {titleS}
          </Typography>
          <Chip
            size="small"
            label={comingSoonS}
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 600,
              bgcolor: SEGMENT_BG,
              color: TEXT_MUTED,
              borderRadius: 999,
            }}
          />
        </Box>
        <Typography variant="body2" sx={{ color: TEXT_FAINT }}>
          {dateLabel}
        </Typography>
      </Box>

      {/* content */}
      <Box sx={{ mt: 2.5 }}>
        {!items.length ? (
          <CardEmptySection
            icon={<EventNote sx={{ fontSize: "1.9rem" }} />}
            iconColor={accentColor}
            title={emptyTitleS}
            hint={emptyHintS}
            animationDelay={0.5}
          />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {items.map((item) => (
              <ListItemDailyScope key={item.scopeId} item={item} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
