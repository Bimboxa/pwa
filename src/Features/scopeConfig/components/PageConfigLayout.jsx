import { Box, Typography } from "@mui/material";

// Grey ground: the white sections read as cards on it. `minHeight: 1` paints
// the whole scroll area, not only the content height.
const PAGE_SX = {
  px: 3,
  py: 2,
  bgcolor: "background.default",
  minHeight: 1,
  boxSizing: "border-box",
};

// Equal columns whatever the content height, collapsed to a single one on a
// narrow window. A page rarely fills the three: the empty columns are what
// keeps the sections narrow on a full-screen dialog, and the generous gap
// narrows them further.
const GRID_SX = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
  gap: 6,
  alignItems: "start",
};

// Shared shell of the Configuration pages: page title (+ optional subtitle)
// over the grey ground, then the WhiteSection children laid out on the grid.
export default function PageConfigLayout({ title, subtitle, children }) {
  return (
    <Box sx={PAGE_SX}>
      <Typography variant="h6" sx={{ mb: subtitle ? 0.5 : 5 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
          {subtitle}
        </Typography>
      )}

      <Box sx={GRID_SX}>{children}</Box>
    </Box>
  );
}
