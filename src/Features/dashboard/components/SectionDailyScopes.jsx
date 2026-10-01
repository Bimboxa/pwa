import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useTheme } from "@mui/material/styles";
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Popover,
  Chip,
} from "@mui/material";
import {
  EventAvailable,
  EventNote,
  Refresh,
  CalendarMonth,
} from "@mui/icons-material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs from "dayjs";
import "dayjs/locale/fr";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDailyScopes from "Features/dailyScopes/hooks/useDailyScopes";
import parseBackendDate from "Features/date/utils/parseBackendDate";
import getLocalDateString from "Features/dailyScopes/utils/getLocalDateString";

import CardEmptySection from "./CardEmptySection";
import ListItemDailyScope from "./ListItemDailyScope";

import { TEXT_FAINT, fadeUp } from "../utils/dashboardStyles";

export default function SectionDailyScopes() {
  const theme = useTheme();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();
  const { dailyScopes, dailyScopesDate, fetchDailyScopes } = useDailyScopes();

  // state

  const [refreshing, setRefreshing] = useState(false);
  const [calendarAnchorEl, setCalendarAnchorEl] = useState(null);

  // date

  const todayS = getLocalDateString();
  const dateS = dailyScopesDate ?? todayS;
  const isToday = dateS === todayS;

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
  const emptyTitleS = isToday
    ? (appConfig?.strings?.scope?.dailyScopeEmptyTitle ??
      "Rien pour aujourd'hui")
    : (appConfig?.strings?.scope?.dailyScopeEmptyTitleOtherDay ??
      "Rien ce jour-là");
  const emptyHintS = isToday
    ? (appConfig?.strings?.scope?.dailyScopeEmptyHint ??
      "Les repérages que vous ouvrez ou modifiez aujourd'hui apparaîtront ici pour un suivi rapide.")
    : (appConfig?.strings?.scope?.dailyScopeEmptyHintOtherDay ??
      "Aucun repérage ouvert ou modifié ce jour-là.");
  const refreshS = "Mettre à jour la liste";
  const pickDayS = "Choisir un jour";
  const backToTodayS = "Revenir à aujourd'hui";

  // helpers

  const accentColor = theme.palette.secondary.main;

  const date = dayjs(dateS);
  const dateLabelS = date.toDate().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.year() !== dayjs().year() && { year: "numeric" }),
  });
  const dateLabel = dateLabelS.charAt(0).toUpperCase() + dateLabelS.slice(1);

  async function loadDay(dayS) {
    setRefreshing(true);
    try {
      await fetchDailyScopes(dayS);
    } finally {
      setRefreshing(false);
    }
  }

  // handlers

  function handleRefresh() {
    loadDay(dateS);
  }

  function handleCalendarChange(value) {
    setCalendarAnchorEl(null);
    if (!value?.isValid()) return;
    loadDay(getLocalDateString(value.toDate()));
  }

  function handleBackToToday() {
    loadDay(todayS);
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
          <Tooltip title={pickDayS}>
            <span>
              <IconButton
                size="small"
                onClick={(e) => setCalendarAnchorEl(e.currentTarget)}
                disabled={refreshing}
              >
                <CalendarMonth sx={{ color: "text.secondary", fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        {isToday ? (
          <Typography variant="body2" sx={{ color: TEXT_FAINT }}>
            {dateLabel}
          </Typography>
        ) : (
          <Tooltip title={backToTodayS}>
            <Chip
              size="small"
              label={dateLabel}
              onDelete={handleBackToToday}
              sx={{ color: accentColor, borderColor: accentColor }}
              variant="outlined"
            />
          </Tooltip>
        )}
      </Box>

      {/* day picker */}
      <Popover
        open={Boolean(calendarAnchorEl)}
        anchorEl={calendarAnchorEl}
        onClose={() => setCalendarAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
          <DateCalendar
            value={date}
            onChange={handleCalendarChange}
            disableFuture
          />
        </LocalizationProvider>
      </Popover>

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
