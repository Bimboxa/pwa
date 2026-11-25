import { useDispatch, useSelector } from "react-redux";

import {
  ROOM_SHAPES,
  setRoomShape,
  setRoomIgnoreColoredLines,
} from "../smartDetectSlice";

import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";

import ShortcutBadge from "./ShortcutBadge";

const SHAPE_LABELS = { AUTO: "Auto", RECTANGLE: "Rectangulaire", L: "L" };

// Options of the « Pièce » drawing tool (ROOM_CLICK), shown in the drawing
// helper: shape of the detected room (F cycles) and coloured strokes filter.
export default function SectionRoomOptions() {
  // strings

  const titleS = "Outil pièce";
  const shapeS = "Forme";
  const ignoreColorsS = "Ignorer les traits en couleur";
  const validateS = "Valider la pièce détectée";
  const rectangleHintS =
    "Clic : tracer un rectangle qui guide la détection (2e clic : créer le rectangle tel quel).";

  // data

  const dispatch = useDispatch();
  const roomShape = useSelector((s) => s.smartDetect.roomShape);
  const ignoreColoredLines = useSelector(
    (s) => s.smartDetect.roomIgnoreColoredLines
  );

  // handlers

  function handleShapeChange(e, shape) {
    if (shape) dispatch(setRoomShape(shape));
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          color: "text.secondary",
          letterSpacing: 0.5,
          mb: 0.5,
          display: "block",
        }}
      >
        {titleS}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {shapeS}
        </Typography>
        <ToggleButtonGroup
          value={roomShape}
          exclusive
          size="small"
          onChange={handleShapeChange}
        >
          {ROOM_SHAPES.map((shape) => (
            <ToggleButton
              key={shape}
              value={shape}
              sx={{
                py: 0.25,
                px: 1,
                fontSize: "0.7rem",
                textTransform: "none",
              }}
            >
              {SHAPE_LABELS[shape]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ShortcutBadge>F</ShortcutBadge>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {validateS}
        </Typography>
        <ShortcutBadge>Espace</ShortcutBadge>
      </Box>
      <Typography
        variant="caption"
        sx={{ display: "block", color: "text.secondary", mb: 0.5 }}
      >
        {rectangleHintS}
      </Typography>
      <FieldCheck
        value={ignoreColoredLines}
        onChange={(v) => dispatch(setRoomIgnoreColoredLines(v))}
        label={ignoreColorsS}
        options={{ type: "switch", showAsInline: true }}
      />
    </WhiteSectionGeneric>
  );
}
