import { Box, Paper, Typography } from "@mui/material";

import ConstraintValueChip from "Features/mapEditor/components/ConstraintValueChip";
import ConstraintShortcutRow from "Features/mapEditor/components/ConstraintShortcutRow";

import {
  formatCopyCountBuffer,
  formatMoveLengthBuffer,
  parseCopyCount,
  parseMoveLength,
} from "../utils/copyBuffer";

// ---------------------------------------------------------------------------
// SectionMultiCopy — « Distance / Copie multiple » card of the « Déplacer »
// helper (2D and 3D), same dress as the « Contraintes » card: the typed
// buffer `<distance>[*<copies>]` (distance of the move, copy count), locked
// once typed, and the keys. Nothing is typed here: the editors feed the
// buffer (transformSessionStore in 2D, threedEditor in 3D).
// ---------------------------------------------------------------------------

export default function SectionMultiCopy({ copyBuffer }) {
  // strings

  const titleS = "Distance / Copie multiple";
  const distanceS = "Distance";
  const copiesS = "Copies";
  const typeLengthS = "Contraindre la distance";
  const typeCopiesS = "Copier N fois";
  const eraseS = "Effacer";
  const helpS =
    "« 1.3 » déplace de 1,30 m dans la direction de la souris ; « *3 » garde l'originale et pose 3 copies, la copie n° i à i × le vecteur ; « 1.3*3 » : 3 copies au pas de 1,30 m.";

  // helpers

  const buffer = copyBuffer ?? "";
  const lengthLocked = parseMoveLength(buffer) != null;
  const countLocked = parseCopyCount(buffer) > 0;
  const countActive = buffer.includes("*");

  // render

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1, borderRadius: 1, bgcolor: "background.paper" }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            color: "text.secondary",
            letterSpacing: 0.5,
            flex: 1,
          }}
        >
          {titleS}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <ConstraintValueChip
          label={distanceS}
          value={formatMoveLengthBuffer(buffer)}
          unit="m"
          locked={lengthLocked}
          isActive={buffer !== "" && !countActive}
        />
        <ConstraintValueChip
          label={copiesS}
          value={formatCopyCountBuffer(buffer)}
          locked={countLocked}
          isActive={countActive}
        />
        <ConstraintShortcutRow label={typeLengthS} keys={["0-9", "."]} />
        <ConstraintShortcutRow label={typeCopiesS} keys={["*", "0-9"]} />
        <ConstraintShortcutRow label={eraseS} keys={["⌫"]} />
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.7rem", px: 0.5 }}
        >
          {helpS}
        </Typography>
      </Box>
    </Paper>
  );
}
