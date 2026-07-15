import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useTheme } from "@mui/material/styles";
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import { EventAvailable, EventNote, Refresh } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDailyScopes from "Features/dailyScopes/hooks/useDailyScopes";
import parseBackendDate from "Features/date/utils/parseBackendDate";

import CardEmptySection from "./CardEmptySection";
import ListItemDailyScope from "./ListItemDailyScope";

import { TEXT_FAINT, fadeUp } from "../utils/dashboardStyles";

export default function SectionDailyScopes() {
  const theme = useTheme();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();
  const { dailyScopes, fetchDailyScopes } = useDailyScopes();

  // state

  const [refreshing, setRefreshing] = useState(false);

  // items — most recent first

  const items = useMemo(() => {
    return [...(dailyScopes ?? [])].sort(
      (a, b) =>
        (parseBackendDate(b.lastConfigurationAt) ?? 0) -
        (parseBackendDate(a.lastConfigurationAt) ?? 0)
    );
  }, [dailyScopes]);

  // strings

  const titleS = appConfig?.strings?.scope?.dailyScope ?? "Repérages du jour";
  const emptyTitleS =
    appConfig?.strings?.scope?.dailyScopeEmptyTitle ?? "Rien pour aujourd'hui";
  const emptyHintS =
    appConfig?.strings?.scope?.dailyScopeEmptyHint ??
    "Les repérages que vous ouvrez ou modifiez aujourd'hui apparaîtront ici pour un suivi rapide.";
  const refreshS = "Mettre à jour la liste";

  // helpers

  const accentColor = theme.palette.secondary.main;

  const dateS = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dateLabel = dateS.charAt(0).toUpperCase() + dateS.slice(1);

  // handlers

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetchDailyScopes();
    } finally {
      setRefreshing(false);
    }
  }

  function handleOpen(item) {
    navigate(`/scopes/${item.scopeId}`);
  }

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
          <Tooltip title={refreshS}>
            <span>
              <IconButton
                size="small"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <CircularProgress size={16} />
                ) : (
                  <Refresh sx={{ color: "text.secondary", fontSize: 18 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
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
              <ListItemDailyScope
                key={item.scopeId}
                item={item}
                onOpen={handleOpen}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
