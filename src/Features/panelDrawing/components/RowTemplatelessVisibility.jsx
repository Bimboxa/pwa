import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import Draw from "@mui/icons-material/Draw";
import FilterCenterFocus from "@mui/icons-material/FilterCenterFocus";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import useDrawTemplateless from "Features/mapEditor/hooks/useDrawTemplateless";

// ---------------------------------------------------------------------------
// RowTemplatelessVisibility — visibility row of the annotations drawn without
// template (« Dessin » command of the commands toolbar) in the docked Dessin
// panel: their count, the solo toggle and the eye — what the former "Dessin"
// tool row offered besides starting a draw. Rendered only when the scope
// holds such annotations.
// ---------------------------------------------------------------------------

export default function RowTemplatelessVisibility({ count = 0 }) {
  // strings

  const labelS = "Annotations sans modèle";
  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";
  const hideS = "Masquer";
  const showS = "Afficher";

  // data

  const { isSolo, isHidden, toggleSolo, toggleHidden } = useDrawTemplateless();

  // render

  if (count <= 0 && !isSolo && !isHidden) return null;

  const buttonSx = {
    p: 0.5,
    color: "panel.textMuted",
    borderRadius: 1,
    "&:hover": { bgcolor: "action.hover" },
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Draw sx={{ fontSize: 20, color: "primary.main", flexShrink: 0 }} />
      <Typography
        variant="body2"
        noWrap
        sx={{
          flex: 1,
          minWidth: 0,
          userSelect: "none",
          color: isHidden ? "text.disabled" : "text.primary",
        }}
      >
        {labelS}
      </Typography>
      <Typography
        noWrap
        sx={{
          fontSize: "10px",
          minWidth: "24px",
          fontFamily: "monospace",
          fontWeight: 500,
          textAlign: "right",
        }}
        color={isHidden ? "text.disabled" : "secondary.main"}
      >
        {count}
      </Typography>
      <Tooltip title={isSolo ? exitSoloS : soloS} arrow>
        <IconButton
          size="small"
          onClick={toggleSolo}
          sx={{
            ...buttonSx,
            ...(isSolo && {
              bgcolor: "secondary.main",
              color: "secondary.contrastText",
              "&:hover": { bgcolor: "secondary.dark" },
            }),
          }}
        >
          <FilterCenterFocus sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={isHidden ? showS : hideS} arrow>
        <IconButton size="small" onClick={toggleHidden} sx={buttonSx}>
          {isHidden ? (
            <VisibilityOff sx={{ fontSize: 16 }} />
          ) : (
            <Visibility sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
