import { useSelector } from "react-redux";

import { Box, Paper, Typography } from "@mui/material";

import ConstraintValueChip from "Features/mapEditor/components/ConstraintValueChip";
import ConstraintShortcutRow from "Features/mapEditor/components/ConstraintShortcutRow";

import PATTERN_REPEAT_DRAWING_MODES from "Features/mapEditor/constants/patternRepeatDrawingModes";
import { parsePatternRepeatCount } from "Features/mapEditor/utils/patternRepeat";

// ---------------------------------------------------------------------------
// SectionDrawingPatternRepeat — « Répétition du motif » card of the drawing
// helper (SectionDrawingHelperContent), click-drawn paths only: `*N` repeats
// the segments drawn since the last repetition N more times, the next click
// (or Enter) appends them and the drawing goes on (utils/patternRepeat.js).
// Reads the buffer the editors feed (mapEditor.patternRepeatBuffer, 2D
// InteractionLayer / 3D useDrawingPointerHandlers): nothing is typed here.
// ---------------------------------------------------------------------------

export default function SectionDrawingPatternRepeat() {
  // strings

  const titleS = "Répétition du motif";
  const hintS = "Répète les segments tracés depuis la dernière répétition.";
  const countS = "Répétitions";
  const repeatS = "Répéter";
  const validateS = "Valider";
  const cancelS = "Annuler";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const patternRepeatBuffer = useSelector(
    (s) => s.mapEditor.patternRepeatBuffer
  );

  // helpers

  const pending = patternRepeatBuffer.length > 0;
  const count = parsePatternRepeatCount(patternRepeatBuffer);

  // render

  if (!PATTERN_REPEAT_DRAWING_MODES.includes(enabledDrawingMode)) return null;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1, borderRadius: 1, bgcolor: "background.paper" }}
    >
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 700,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          color: "text.secondary",
          letterSpacing: 0.5,
          mb: 0.75,
        }}
      >
        {titleS}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.75rem", px: 0.5 }}
        >
          {hintS}
        </Typography>
        <ConstraintValueChip
          label={countS}
          value={pending ? `×${count}` : "—"}
          locked={pending}
        />
        <ConstraintShortcutRow label={repeatS} keys={["*", "0-9"]} />
        <ConstraintShortcutRow label={validateS} keys={["Clic"]} />
        <ConstraintShortcutRow label={cancelS} keys={["Esc"]} />
      </Box>
    </Paper>
  );
}
