import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import { Close } from "@mui/icons-material";

import { COL_WIDTH, ROW_HEIGHT } from "../constants/planningDefaults";
import formatConsumedVsBudget from "../utils/formatConsumedVsBudget";
import { formatHours } from "Features/businessObjects/utils/hoursRatioConversions";

function getContrastText(theme, color) {
  try {
    return theme.palette.getContrastText(color);
  } catch {
    return "#fff";
  }
}

// One block of the grid: a resource on a work package during `steps` steps.
export default function PlanningSlotBlock({
  slot,
  workPackage,
  startStep,
  steps,
  hours,
  consumed,
  budget,
  selected,
  dragging,
  onPointerDownMove,
  onPointerDownResize,
  onDelete,
}) {
  const theme = useTheme();
  const color = workPackage?.color ?? theme.palette.grey[500];
  const textColor = getContrastText(theme, color);
  const { text: totalS, diff } = formatConsumedVsBudget(consumed, budget);
  const tooltip = `${workPackage?.label ?? "Tâche supprimée"} — ${formatHours(
    hours
  )} sur ce bloc · ${totalS} au total${
    diff == null
      ? ""
      : diff > 0
        ? ` (dépassement ${formatHours(diff, { withDays: false })})`
        : ` (reste ${formatHours(-diff, { withDays: false })})`
  }`;

  return (
    <Tooltip title={tooltip} enterDelay={600} disableInteractive>
      <Box
        onPointerDown={onPointerDownMove}
        sx={{
          position: "absolute",
          left: startStep * COL_WIDTH + 1,
          top: 3,
          width: steps * COL_WIDTH - 2,
          height: ROW_HEIGHT - 6,
          bgcolor: color,
          color: textColor,
          borderRadius: "3px",
          opacity: dragging ? 0.7 : 0.9,
          outline: selected ? "2px solid" : "none",
          outlineColor: "primary.main",
          outlineOffset: 1,
          display: "flex",
          alignItems: "center",
          px: 0.75,
          cursor: "grab",
          userSelect: "none",
          zIndex: selected ? 2 : 1,
          "&:hover .planning-slot-delete": { visibility: "visible" },
        }}
      >
        <Typography
          variant="caption"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontWeight: 500, lineHeight: 1 }}
        >
          {workPackage?.label ?? "?"}
        </Typography>
        <IconButton
          className="planning-slot-delete"
          size="small"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(slot);
          }}
          sx={{
            visibility: "hidden",
            p: 0,
            ml: 0.25,
            color: "inherit",
            width: 16,
            height: 16,
          }}
        >
          <Close sx={{ fontSize: 12 }} />
        </IconButton>
        {/* right-edge resize zone */}
        <Box
          onPointerDown={onPointerDownResize}
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 6,
            cursor: "ew-resize",
          }}
        />
      </Box>
    </Tooltip>
  );
}
