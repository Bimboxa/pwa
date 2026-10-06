import { Box, Typography } from "@mui/material";

// Shared header of the module left drawers: the designation of the items
// listed below (e.g. "Annotations", "Mailles"). `children` replaces the
// title (e.g. the Viewer panel's tabs toggle). The dock toggle lives in the
// top bar (ButtonToggleLeftPanelDock).
export default function LeftDrawerPanelHeader({ title, children }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        pl: 2,
        pr: 2,
        pt: 1,
        pb: 0.5,
        minWidth: 0,
      }}
    >
      {children ?? (
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ color: "text.secondary", textTransform: "uppercase" }}
        >
          {title}
        </Typography>
      )}
    </Box>
  );
}
