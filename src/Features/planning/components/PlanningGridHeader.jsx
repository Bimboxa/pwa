import { Box, Typography } from "@mui/material";

import {
  COL_WIDTH,
  HEADER_HEIGHT,
  LEFT_COL_WIDTH,
} from "../constants/planningDefaults";
import { getStepsPerDay } from "../utils/planningTimeAxis";

// Sticky header: day labels (spanning the day's steps) over step sub-labels.
export default function PlanningGridHeader({ planning, columns }) {
  const spd = getStepsPerDay(planning);
  const isSteps = planning?.timeAxisMode === "STEPS";
  const days = [];
  columns.forEach((c) => {
    if (c.isDayStart) days.push({ ...c, span: 0 });
    if (days.length > 0) days[days.length - 1].span += 1;
  });

  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 4,
        display: "flex",
        height: HEADER_HEIGHT,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          position: "sticky",
          left: 0,
          zIndex: 5,
          width: LEFT_COL_WIDTH,
          minWidth: LEFT_COL_WIDTH,
          bgcolor: "background.paper",
          borderRight: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "flex-end",
          px: 1,
          pb: 0.5,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {isSteps ? "Pas de temps" : "Jours ouvrés"}
        </Typography>
      </Box>
      <Box
        sx={{
          position: "relative",
          width: columns.length * COL_WIDTH,
          minWidth: columns.length * COL_WIDTH,
        }}
      >
        {/* day labels */}
        <Box sx={{ display: "flex", height: HEADER_HEIGHT / 2 }}>
          {days.map((d) => (
            <Box
              key={d.step}
              sx={{
                width: d.span * COL_WIDTH,
                minWidth: d.span * COL_WIDTH,
                borderLeft: d.isWeekStart ? "2px solid" : "1px solid",
                borderColor: d.isWeekStart ? "text.secondary" : "divider",
                px: 0.5,
                display: "flex",
                alignItems: "center",
                overflow: "hidden",
              }}
            >
              <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>
                {d.dayLabel}
              </Typography>
            </Box>
          ))}
        </Box>
        {/* step sub-labels */}
        <Box sx={{ display: "flex", height: HEADER_HEIGHT / 2 }}>
          {columns.map((c) => (
            <Box
              key={c.step}
              sx={{
                width: COL_WIDTH,
                minWidth: COL_WIDTH,
                borderLeft: c.isDayStart ? "1px solid" : "1px dashed",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <Typography variant="caption" color="text.secondary" noWrap>
                {spd > 1 || isSteps ? c.subLabel : ""}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
