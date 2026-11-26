import { useDispatch, useSelector } from "react-redux";

import {
  HIGHLIGHT_VECTORIZE_SHAPES,
  setHighlightVectorizeShape,
  stepHighlightBrushSize,
} from "../smartDetectSlice";

import {
  Box,
  IconButton,
  SvgIcon,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Remove } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import ShortcutBadge from "./ShortcutBadge";

// label + icon path (24 x 24) of each shape the tool can fit
const SHAPES = {
  ARC: { label: "Arc", path: "M 3.5 17.5 A 9.5 9.5 0 0 1 20.5 17.5" },
  LINE: { label: "Ligne droite", path: "M 4 19 L 20 5" },
  RIGHT_ANGLE: {
    label: "Angle droit",
    path: "M 5.5 4.5 L 5.5 18.5 L 19.5 18.5",
  },
  FREE: { label: "Libre", path: "M 3 17 L 8 7.5 L 13 15.5 L 21 6" },
};

const SECTION_TITLE_SX = {
  fontWeight: 700,
  fontSize: "0.7rem",
  textTransform: "uppercase",
  color: "text.secondary",
  letterSpacing: 0.5,
  mb: 0.5,
  display: "block",
};

// Options of the « Vectoriser au surligneur » drawing tool, shown in the
// drawing helper: shape fitted through the highlighted points (F cycles)
// and width of the highlighter (Z / W), in screen px.
export default function SectionHighlightVectorizeOptions() {
  // strings

  const shapeTitleS = "Type de ligne";
  const brushTitleS = "Surligneur";
  const hintS =
    "Largeur du trait à l'écran, quel que soit le zoom : seuls les points sous le trait sont pris en compte.";

  // data

  const dispatch = useDispatch();
  const shape = useSelector((s) => s.smartDetect.highlightVectorizeShape);
  const sizePx = useSelector((s) => s.smartDetect.highlightBrushSizePx);

  // helpers

  const sizeS = `Largeur : ${sizePx} px`;

  // handlers

  function handleShapeChange(e, newShape) {
    if (newShape) dispatch(setHighlightVectorizeShape(newShape));
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="caption" sx={SECTION_TITLE_SX}>
        {shapeTitleS}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <ToggleButtonGroup
          value={shape}
          exclusive
          size="small"
          onChange={handleShapeChange}
          sx={{ flexGrow: 1 }}
        >
          {HIGHLIGHT_VECTORIZE_SHAPES.map((key) => {
            const isActive = key === shape;
            return (
              <Tooltip key={key} title={isActive ? "" : SHAPES[key].label}>
                <ToggleButton
                  value={key}
                  aria-label={SHAPES[key].label}
                  sx={{
                    py: 0.25,
                    px: 0.75,
                    gap: 0.5,
                    fontSize: "0.7rem",
                    textTransform: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <SvgIcon fontSize="small" viewBox="0 0 24 24">
                    <path
                      d={SHAPES[key].path}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </SvgIcon>
                  {isActive && SHAPES[key].label}
                </ToggleButton>
              </Tooltip>
            );
          })}
        </ToggleButtonGroup>
        <ShortcutBadge>F</ShortcutBadge>
      </Box>
      <Typography variant="caption" sx={SECTION_TITLE_SX}>
        {brushTitleS}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {sizeS}
        </Typography>
        <ShortcutBadge>W</ShortcutBadge>
        <IconButton
          size="small"
          onClick={() => dispatch(stepHighlightBrushSize(-1))}
        >
          <Remove fontSize="inherit" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => dispatch(stepHighlightBrushSize(1))}
        >
          <Add fontSize="inherit" />
        </IconButton>
        <ShortcutBadge>Z</ShortcutBadge>
      </Box>
      <Typography
        variant="caption"
        sx={{ display: "block", color: "text.secondary" }}
      >
        {hintS}
      </Typography>
    </WhiteSectionGeneric>
  );
}
