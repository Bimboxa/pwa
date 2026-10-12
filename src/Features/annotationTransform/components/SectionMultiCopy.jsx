import { Box, Paper, Typography } from "@mui/material";

import ConstraintValueChip from "Features/mapEditor/components/ConstraintValueChip";
import ConstraintShortcutRow from "Features/mapEditor/components/ConstraintShortcutRow";

import { formatCopyBuffer, parseCopyCount } from "../utils/copyBuffer";

// ---------------------------------------------------------------------------
// SectionMultiCopy — « Copie multiple » card of the « Déplacer » helper (2D
// and 3D), same dress as the « Contraintes » card: the typed copy buffer
// ("x3", locked once typed) and the keys. Nothing is typed here: the editors
// feed the buffer (transformSessionStore in 2D, threedEditor in 3D).
// ---------------------------------------------------------------------------

export default function SectionMultiCopy({ copyBuffer }) {
  // strings

  const titleS = "Copie multiple";
  const copiesS = "Copies";
  const typeS = "Copier N fois";
  const eraseS = "Effacer";
  const helpS =
    "L'originale reste en place ; la copie n° i est posée à i × le vecteur point saisi → point cliqué.";

  // helpers

  const buffer = copyBuffer ?? "";
  const count = parseCopyCount(buffer);
  const locked = count > 0;

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
          label={copiesS}
          value={formatCopyBuffer(buffer)}
          locked={locked}
          isActive={buffer !== ""}
        />
        <ConstraintShortcutRow label={typeS} keys={["x", "0-9"]} />
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
