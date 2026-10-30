import { useSelector } from "react-redux";

import { Box, Paper, Typography } from "@mui/material";

import KeyChip from "Features/annotations/components/KeyChip";
import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";

// Drawing-helper card of the arrow-key axis lock in the 3D editor
// (useDrawingPointerHandlers.onAxisLockKey): one row with the three arrows
// and the user axis each one locks — ↑ the axis most vertical on screen,
// → the most horizontal, ↓ the third (drawingMode.arrowAxes, which follows
// the camera) — the locked axis filled in its colour; one row for ←, which
// releases the lock. The letters take the gizmo colours (AXIS_COLORS).

const ARROWS = [
  { dir: "up", glyph: "↑" },
  { dir: "right", glyph: "→" },
  { dir: "down", glyph: "↓" },
];

export default function SectionThreedAxisLockHelper() {
  // strings

  const titleS = "Verrou d'axe";
  const releaseS = "Annuler le verrou d'axe";

  // data

  const axisLock = useSelector((s) => s.threedEditor.drawingMode.axisLock);
  const arrowAxes = useSelector((s) => s.threedEditor.drawingMode.arrowAxes);

  // render

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1,
        py: 0.5,
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {titleS}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {ARROWS.map(({ dir, glyph }) => {
            const axis = arrowAxes?.[dir];
            const color = AXIS_COLORS[axis];
            const locked = Boolean(axis) && axisLock === axis;
            return (
              <Box
                key={dir}
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <KeyChip filled={locked} color={color}>
                  {glyph}
                </KeyChip>
                <Typography
                  variant="caption"
                  sx={{ color, fontWeight: 700, minWidth: "1ch" }}
                >
                  {axis ?? ""}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: axisLock ? "text.primary" : "text.disabled" }}
        >
          {releaseS}
        </Typography>
        <KeyChip disabled={!axisLock}>←</KeyChip>
      </Box>
    </Paper>
  );
}
