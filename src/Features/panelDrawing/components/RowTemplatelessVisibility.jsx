import { useState } from "react";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Tune from "@mui/icons-material/Tune";

import SoloIconToggle from "Features/mapEditor/components/SoloIconToggle";
import IconTemplatelessPolygon from "Features/mapEditor/components/IconTemplatelessPolygon";
import useDrawTemplateless from "Features/mapEditor/hooks/useDrawTemplateless";
import useOpenTemplatelessAnnotationsPanel from "Features/mapEditor/hooks/useOpenTemplatelessAnnotationsPanel";

// ---------------------------------------------------------------------------
// RowTemplatelessVisibility — visibility row of the annotations drawn without
// template (« Dessin » command of the commands toolbar) in the docked Dessin
// panel, pinned at the top above the revolution axes in the same white
// rounded card as the axis rows: their count, the row icon (light grey
// polygon) as solo toggle, the properties button and the eye — what the
// former "Dessin" tool row offered besides starting a draw. Rendered only
// when the scope holds such annotations.
// ---------------------------------------------------------------------------

export default function RowTemplatelessVisibility({ count = 0 }) {
  // strings

  const labelS = "Annotations sans modèle";
  const propertiesS = "Propriétés";
  const hideS = "Masquer";
  const showS = "Afficher";

  // data

  const { isSolo, isHidden, toggleSolo, toggleHidden } = useDrawTemplateless();
  const openProperties = useOpenTemplatelessAnnotationsPanel();

  // state

  const [isHovered, setIsHovered] = useState(false);

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        // Same card as the axis rows below (SectionRevolutionAxes `card`).
        mx: 1,
        my: 1,
        pl: 1,
        pr: 0.5,
        py: 0.5,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "panel.border",
        borderRadius: 2,
      }}
    >
      {/* Row icon = SOLO toggle, as on the template rows: a light grey
          polygon, the mark of a shape drawn without template. */}
      <SoloIconToggle
        isSolo={isSolo}
        isHidden={isHidden}
        isRowHovered={isHovered}
        onToggle={toggleSolo}
      >
        <IconTemplatelessPolygon />
      </SoloIconToggle>
      <Typography
        variant="body2"
        noWrap
        sx={{
          flex: 1,
          minWidth: 0,
          userSelect: "none",
          fontStyle: "italic",
          color: isHidden ? "text.disabled" : "panel.textSecondary",
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
      <Tooltip title={propertiesS} arrow>
        <IconButton size="small" onClick={openProperties} sx={buttonSx}>
          <Tune sx={{ fontSize: 16 }} />
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
