import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { WarningAmberRounded, AddLink } from "@mui/icons-material";

// Thin warning band under the header of an installed project that is not
// linked to the référentiel (chantier / opportunité): nudges the user to link
// it, the button opening the same dialog as the « … » menu entry.
export default function BandLinkProjectToReferentiel({ onLink }) {
  // data

  const appConfig = useAppConfig();

  // strings

  const hintS =
    appConfig?.strings?.project?.linkToReferentielHint ??
    "Relier le projet à une opportunité / chantier";
  const linkS =
    appConfig?.strings?.project?.linkToReferentielButton ?? "Relier";

  // render

  return (
    <Box
      sx={{
        px: 3,
        py: 0.75,
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
        borderBottom: (theme) =>
          `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
      }}
    >
      <WarningAmberRounded sx={{ fontSize: 18, color: "warning.main" }} />
      <Typography
        variant="body2"
        noWrap
        sx={{ flex: 1, minWidth: 0, fontWeight: 500 }}
      >
        {hintS}
      </Typography>
      <Button
        size="small"
        variant="contained"
        startIcon={<AddLink />}
        onClick={onLink}
        sx={{
          whiteSpace: "nowrap",
          flexShrink: 0,
          bgcolor: "warning.main",
          color: "warning.contrastText",
          "&:hover": { bgcolor: "warning.dark" },
        }}
      >
        {linkS}
      </Button>
    </Box>
  );
}
