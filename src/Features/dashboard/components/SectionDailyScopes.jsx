import { useTheme } from "@mui/material/styles";
import { Box, Typography, Avatar, Chip } from "@mui/material";
import { EventAvailable, EventNote } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import CardEmptySection from "./CardEmptySection";

export default function SectionDailyScopes() {
  const theme = useTheme();

  // data

  const appConfig = useAppConfig();

  // strings

  const titleS = appConfig?.strings?.scope?.dailyScope ?? "Repérages du jour";
  const subtitleS =
    appConfig?.strings?.scope?.dailyScopeSubtitle ??
    "Les repérages ouverts aujourd'hui";
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
    <Box sx={{ mt: 6 }}>
      {/* header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar
          sx={{
            width: 52,
            height: 52,
            bgcolor: accentColor + "1f",
            color: accentColor,
          }}
        >
          <EventAvailable />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {titleS}
            </Typography>
            <Chip
              size="small"
              label={comingSoonS}
              sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {subtitleS}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {dateLabel}
        </Typography>
      </Box>

      {/* content */}
      <Box sx={{ mt: 2.5 }}>
        <CardEmptySection
          icon={<EventNote sx={{ fontSize: "2rem" }} />}
          iconColor={accentColor}
          title={emptyTitleS}
          hint={emptyHintS}
        />
      </Box>
    </Box>
  );
}
