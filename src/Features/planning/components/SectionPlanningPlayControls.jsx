import { useDispatch, useSelector } from "react-redux";

import { setPlayActive, setPlayStep } from "../planningSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import {
  ChevronLeft,
  ChevronRight,
  PlayArrow,
  Stop,
} from "@mui/icons-material";

import {
  getNowStep,
  stepToDate,
  formatDayLabel,
} from "../utils/planningTimeAxis";

// "Play" of the planning: steps through the columns with ‹ ›; the grid
// highlights the current step and the map renders the zones by status
// (done / in progress / to do).
export default function SectionPlanningPlayControls({ planning }) {
  const dispatch = useDispatch();
  const playActive = useSelector((s) => s.planning.playActive);
  const playStep = useSelector((s) => s.planning.playStep);

  if (!planning) return null;

  // strings

  const { dateStr, startHour, dayIndex, slotIndex } = stepToDate(
    planning,
    playStep
  );
  const stepS =
    planning.timeAxisMode === "CALENDAR"
      ? `${formatDayLabel(dateStr)} · ${startHour}h`
      : `Pas ${playStep + 1} · J${dayIndex + 1}${slotIndex > 0 ? `+${slotIndex}` : ""}`;

  // handlers

  function handleToggle() {
    if (playActive) {
      dispatch(setPlayActive({ active: false }));
      return;
    }
    const now = getNowStep(planning);
    dispatch(
      setPlayActive({
        active: true,
        step: Number.isFinite(now) ? Math.floor(now) : 0,
      })
    );
  }

  // render

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      {playActive && (
        <>
          <IconButton
            size="small"
            onClick={() => dispatch(setPlayStep(playStep - 1))}
            disabled={playStep <= 0}
            title="Créneau précédent"
          >
            <ChevronLeft sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography
            variant="caption"
            noWrap
            sx={{ minWidth: 96, textAlign: "center", fontWeight: 600 }}
          >
            {stepS}
          </Typography>
          <IconButton
            size="small"
            onClick={() => dispatch(setPlayStep(playStep + 1))}
            title="Créneau suivant"
          >
            <ChevronRight sx={{ fontSize: 18 }} />
          </IconButton>
        </>
      )}
      <Tooltip title={playActive ? "Arrêter" : "Play — parcourir les créneaux"}>
        <IconButton
          size="small"
          color={playActive ? "primary" : "default"}
          onClick={handleToggle}
        >
          {playActive ? (
            <Stop sx={{ fontSize: 18 }} />
          ) : (
            <PlayArrow sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
