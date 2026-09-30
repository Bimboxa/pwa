import { Box, Typography } from "@mui/material";

import SectionBaseMapsList from "Features/baseMaps/components/SectionBaseMapsList";

// ---------------------------------------------------------------------------
// PanelViewerBaseMaps — "Fonds de plan" tab of the Viewer module's left
// panel: the scope's base maps with their visibility toggles (image,
// annotations, 3D scan) — replaces the removed floating chips band.
// `header`: header of the panel, provided by PanelViewer (tabs toggle).
// ---------------------------------------------------------------------------

export default function PanelViewerBaseMaps({ header }) {
  // strings

  const descriptionS =
    "Sélectionnez le fond de plan affiché et réglez la visibilité de " +
    "l'image, des annotations et du scan 3D de chacun.";

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
        bgcolor: "background.default",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {header}
      <Typography
        variant="caption"
        sx={{ px: 2, pb: 1, color: "text.secondary" }}
      >
        {descriptionS}
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pb: 1 }}>
        <SectionBaseMapsList />
      </Box>
    </Box>
  );
}
