import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSelector } from "react-redux";

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
  ChevronLeft,
  ChevronRight,
  Person,
} from "@mui/icons-material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs from "dayjs";
import "dayjs/locale/fr";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDailyScopes from "Features/dailyScopes/hooks/useDailyScopes";
import useLocalDailyScopes from "Features/dailyScopes/hooks/useLocalDailyScopes";
import useOpenDashboardScope from "../hooks/useOpenDashboardScope";
import parseBackendDate from "Features/date/utils/parseBackendDate";
import getLocalDateString from "Features/dailyScopes/utils/getLocalDateString";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";
import { normalizeOwnerId } from "App/db/ownership";

import CardEmptySection from "./CardEmptySection";
import ListItemDailyScope from "./ListItemDailyScope";

import { TEXT_FAINT, fadeUp } from "../utils/dashboardStyles";

export default function SectionDailyScopes() {
  const theme = useTheme();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();
  const { dailyScopes, dailyScopesDate, fetchDailyScopes } = useDailyScopes();
  const openScope = useOpenDashboardScope();
  const currentUserId = useSelector((s) =>
    normalizeOwnerId(getUserIdMaster(s.auth.userProfile))
  );

  // state

  const [refreshing, setRefreshing] = useState(false);
  const [calendarAnchorEl, setCalendarAnchorEl] = useState(null);
  const [onlyMine, setOnlyMine] = useState(false);

  // date

  const todayS = getLocalDateString();
  const dateS = dailyScopesDate ?? todayS;
  const isToday = dateS === todayS;

  const localDailyScopes = useLocalDailyScopes(dateS);

  // items — server list merged with the Krtos worked on locally that day
  // (one row per scope, most recent activity wins), most recent first,
  // optionally restricted to the current user's

  const allItems = useMemo(() => {
    const byScopeId = new Map();
    (dailyScopes ?? []).forEach((item) =>
      byScopeId.set(String(item.scopeId), item)
    );
    localDailyScopes.forEach((local) => {
      const id = String(local.scopeId);
      const remote = byScopeId.get(id);
      if (!remote) {
        byScopeId.set(id, local);
        return;
      }
      const localIsNewer =
        (parseBackendDate(local.lastConfigurationAt) ?? 0) >
        (parseBackendDate(remote.lastConfigurationAt) ?? 0);
      byScopeId.set(id, {
        ...remote,
        isLocal: true,
        hasLocalActivity: true,
        projectId: local.projectId,
        projectType: remote.projectType ?? local.projectType,
        ...(localIsNewer && {
          lastConfigurationAt: local.lastConfigurationAt,
        }),
      });
    });
    return [...byScopeId.values()];
  }, [dailyScopes, localDailyScopes]);

  const items = useMemo(() => {
    return allItems
      .filter(
        (item) =>
          !onlyMine ||
          item.hasLocalActivity ||
          (currentUserId !== null &&
            normalizeOwnerId(item.createdBy?.idMaster) === currentUserId)
      )
      .sort(
        (a, b) =>
          (parseBackendDate(b.lastConfigurationAt) ?? 0) -
          (parseBackendDate(a.lastConfigurationAt) ?? 0)
      );
  }, [allItems, onlyMine, currentUserId]);

  // strings

  const titleS = appConfig?.strings?.scope?.dailyScope ?? "Dossiers du jour";
  const myScopesS = appConfig?.strings?.scope?.myScopes ?? "Mes dossiers";
  const emptyTitleS = isToday
    ? (appConfig?.strings?.scope?.dailyScopeEmptyTitle ??
      "Rien pour aujourd'hui")
    : (appConfig?.strings?.scope?.dailyScopeEmptyTitleOtherDay ??
      "Rien ce jour-là");
  const emptyHintS =
    onlyMine && allItems.length
      ? (appConfig?.strings?.scope?.dailyScopeEmptyHintMine ??
        "Aucun de vos dossiers n'a été ouvert ou modifié ce jour-là.")
      : isToday
        ? (appConfig?.strings?.scope?.dailyScopeEmptyHint ??
          "Les dossiers que vous ouvrez ou modifiez aujourd'hui apparaîtront ici pour un suivi rapide.")
        : (appConfig?.strings?.scope?.dailyScopeEmptyHintOtherDay ??
          "Aucun dossier ouvert ou modifié ce jour-là.");
  const refreshS = "Mettre à jour la liste";
  const pickDayS = "Choisir un jour";
  const backToTodayS = "Revenir à aujourd'hui";
  const previousDayS = "Jour précédent";
  const nextDayS = "Jour suivant";

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

  function handleShiftDay(delta) {
    const next = date.add(delta, "day");
    if (next.isAfter(dayjs(todayS), "day")) return;
    loadDay(getLocalDateString(next.toDate()));
  }

  function handleOpen(item) {
    if (item.isLocal) {
      openScope({
        row: { scopeId: item.scopeId, isLocal: true },
        projectId: item.projectId,
      });
    } else {
      navigate(`/scopes/${item.scopeId}`);
    }
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <Tooltip title={previousDayS}>
            <span>
              <IconButton
                size="small"
                onClick={() => handleShiftDay(-1)}
                disabled={refreshing}
              >
                <ChevronLeft sx={{ color: "text.secondary", fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>
          {isToday ? (
            <Typography variant="body2" sx={{ color: TEXT_FAINT, px: 0.5 }}>
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
          <Tooltip title={isToday ? "" : nextDayS}>
            <span>
              <IconButton
                size="small"
                onClick={() => handleShiftDay(1)}
                disabled={refreshing || isToday}
              >
                <ChevronRight
                  sx={{
                    color: isToday ? "action.disabled" : "text.secondary",
                    fontSize: 20,
                  }}
                />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* filters */}
      <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Chip
          size="small"
          icon={<Person />}
          label={myScopesS}
          variant={onlyMine ? "filled" : "outlined"}
          onClick={() => setOnlyMine((v) => !v)}
          sx={{
            fontWeight: 600,
            ...(onlyMine
              ? {
                  bgcolor: accentColor,
                  color: "white",
                  "& .MuiChip-icon": { color: "white" },
                  "&:hover": { bgcolor: accentColor, opacity: 0.9 },
                }
              : {
                  bgcolor: "white",
                  "& .MuiChip-icon": { color: "text.secondary" },
                }),
          }}
        />
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
      <Box sx={{ mt: 2 }}>
        {!items.length ? (
          <CardEmptySection
            icon={<EventNote sx={{ fontSize: "1.9rem" }} />}
            iconColor={accentColor}
            title={emptyTitleS}
            hint={emptyHintS}
            animationDelay={0.5}
          />
        ) : (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              // items still belong to the previous day while loading
              opacity: refreshing ? 0.5 : 1,
              transition: "opacity 150ms",
            }}
          >
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
