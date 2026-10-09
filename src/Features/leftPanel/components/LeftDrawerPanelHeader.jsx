import { Box, IconButton, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";

// Shared header of the module left drawers: the designation of the items
// listed below (e.g. "Annotations", "Mailles"). `children` replaces the
// title (e.g. the Viewer panel's tabs toggle). The dock toggle lives in the
// top bar (ButtonToggleLeftPanelDock).
//
// `onClose` (optional) adds a close cross on the right: the floated variants
// of a panel (e.g. the SCOPE module's PanelSelectorListingFloating) have no
// dock toggle to fold them, so the cross is their way back.
export default function LeftDrawerPanelHeader({ title, children, onClose }) {
  // strings

  const closeS = "Fermer";

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        pl: 2,
        pr: onClose ? 1 : 2,
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
      {onClose && (
        <>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={onClose} title={closeS}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </>
      )}
    </Box>
  );
}
