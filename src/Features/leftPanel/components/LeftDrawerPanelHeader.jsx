import { Box, Typography } from "@mui/material";

import ButtonToggleLeftPanelDock from "./ButtonToggleLeftPanelDock";

// Shared header of the module left drawers: dock toggle followed by the
// designation of the items listed below (e.g. "Annotations", "Mailles").
export default function LeftDrawerPanelHeader({ title, hideDockToggle }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        pl: hideDockToggle ? 2 : 1,
        pr: 2,
        pt: 1,
        pb: 0.5,
        minWidth: 0,
      }}
    >
      {!hideDockToggle && <ButtonToggleLeftPanelDock iconFontSize={18} />}
      <Typography
        variant="subtitle2"
        noWrap
        sx={{ color: "text.secondary", textTransform: "uppercase" }}
      >
        {title}
      </Typography>
    </Box>
  );
}
