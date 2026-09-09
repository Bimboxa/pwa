import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import { Close } from "@mui/icons-material";

import { COL_WIDTH, ROW_HEIGHT } from "../constants/planningDefaults";
import formatConsumedVsBudget from "../utils/formatConsumedVsBudget";
import { formatHours } from "Features/businessObjects/utils/hoursRatioConversions";

const HANDLE_WIDTH = 8;

function getContrastText(theme, color) {
  try {
    return theme.palette.getContrastText(color);
  } catch {
    return "#fff";
  }
}

// One block of the grid: a resource on a work package during `steps` steps.
// Interaction is pointerdown-driven (the grid has no onClick: a stray click
// after a drag would reach the row band and create a block). An unselected
// block is click-only: pressing it selects it. Only a SELECTED block can be
// moved and shows its two resize handles (left = start, right = end).
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
  onPointerDown,
  onPointerDownResizeStart,
  onPointerDownResizeEnd,
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

  // A 1-step block is only 38 px wide: with both handles out there is no room
  // left for the delete button (Delete on the selected block does the job).
  const showDelete = !(selected && steps < 2);

  const handleSx = {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: HANDLE_WIDTH,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "ew-resize",
  };

  return (
    <Tooltip
      title={tooltip}
      enterDelay={600}
      disableInteractive
      disableHoverListener={dragging}
    >
      <Box
        onPointerDown={onPointerDown}
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
          px: selected ? 1 : 0.75,
          cursor: selected ? (dragging ? "grabbing" : "grab") : "pointer",
          // A selected block owns the gesture; an unselected one stays
          // transparent to the grid's own scrolling.
          touchAction: selected ? "none" : "auto",
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
        {showDelete && (
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
        )}
        {/* resize handles — only on the selected block */}
        {selected && (
          <>
            <Box
              onPointerDown={onPointerDownResizeStart}
              sx={{ ...handleSx, left: 0 }}
            >
              <Box
                sx={{
                  width: 2,
                  height: "55%",
                  borderRadius: 1,
                  bgcolor: textColor,
                  opacity: 0.8,
                }}
              />
            </Box>
            <Box
              onPointerDown={onPointerDownResizeEnd}
              sx={{ ...handleSx, right: 0 }}
            >
              <Box
                sx={{
                  width: 2,
                  height: "55%",
                  borderRadius: 1,
                  bgcolor: textColor,
                  opacity: 0.8,
                }}
              />
            </Box>
          </>
        )}
      </Box>
    </Tooltip>
  );
}
