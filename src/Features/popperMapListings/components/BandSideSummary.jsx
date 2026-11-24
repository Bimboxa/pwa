import { Box, Typography } from "@mui/material";

// ---------------------------------------------------------------------------
// BandSideSummary — band right under the header of the annotations poppers
// and of the docked Dessin panel: the summary of the displayed side on the
// left (`title`), its actions on the right (`children`). See
// BandAnnotationsSummary (annotations side) and BandBaseMapsSummary
// ("Fonds de plan" side).
// ---------------------------------------------------------------------------

export default function BandSideSummary({ title, children, sx }) {
  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        flexShrink: 0,
        pl: 1.5,
        pr: 1,
        py: 0.5,
        // Same height with or without actions.
        minHeight: 32,
        userSelect: "none",
        // Same tinted block as the "Listes d'annotations" header.
        bgcolor: "background.default",
        ...sx,
      }}
    >
      <Typography
        variant="caption"
        noWrap
        sx={{
          flex: 1,
          minWidth: 0,
          fontWeight: 600,
          color: "panel.textMuted",
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}
