import { Box, Typography } from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

// ---------------------------------------------------------------------------
// ConstraintShortcutRow — one shortcut line of the « Contraintes » card
// (SectionDrawingConstraints): the action on the left, its key badge(s) on
// the right. Same gauge as the rows of SectionShortcutHelpers.
// ---------------------------------------------------------------------------

export default function ConstraintShortcutRow({ label, keys }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        px: 0.5,
      }}
    >
      <Typography
        variant="body2"
        sx={{ color: "text.primary", fontSize: "0.85rem" }}
      >
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        {keys.map((k, i) => (
          <ShortcutBadge key={i}>{k}</ShortcutBadge>
        ))}
      </Box>
    </Box>
  );
}
