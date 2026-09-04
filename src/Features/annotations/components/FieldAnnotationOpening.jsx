import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Button,
} from "@mui/material";
import { Flip as FlipIcon } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldAnnotationTemplateOpening from "./FieldAnnotationTemplateOpening";

import { getOpeningType } from "Features/annotations/utils/isOpeningAnnotation";
import { openingToggleGroupSx } from "Features/annotations/constants/openingFieldOptions";

import db from "App/db/db";

const HINGE_OPTIONS = [
  { value: "START", label: "Gauche" },
  { value: "END", label: "Droite" },
];

// Keyboard badge shown next to a control (the hotkey acts on the selected
// door in the map editor).
function KeyBadge({ children }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{
        px: 0.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 0.75,
        lineHeight: 1.4,
        fontFamily: "monospace",
      }}
    >
      {children}
    </Typography>
  );
}

// Per-annotation opening editor (PanelProperties): the opening type (same UI
// as the template field, written on the annotation row), and for a DOOR its
// hinge end ("sens d'ouverture", Tab) and swing side ("côté", S). Field
// locked by the template padlock: the type toggle is disabled.
export default function FieldAnnotationOpening({ annotation, overrideFields }) {
  const dispatch = useDispatch();

  // data

  const openingType = getOpeningType(annotation);
  const doorHinge = annotation?.doorHinge === "END" ? "END" : "START";
  const doorSide = annotation?.doorSide === -1 ? -1 : 1;
  const typeLocked =
    Array.isArray(overrideFields) && overrideFields.includes("openingType");

  // handlers

  async function update(patch) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, patch);
    dispatch(triggerAnnotationsUpdate());
  }

  function handleTypeChange(updated) {
    if (typeLocked) return;
    const next = getOpeningType(updated);
    if (next !== openingType) update({ openingType: next });
  }

  function handleHingeChange(e, next) {
    if (next === null || next === doorHinge) return;
    update({ doorHinge: next });
  }

  function handleFlipSide() {
    update({ doorSide: doorSide * -1 });
  }

  // render

  return (
    <>
      <Box
        sx={{
          opacity: typeLocked ? 0.6 : 1,
          pointerEvents: typeLocked ? "none" : "auto",
        }}
      >
        <FieldAnnotationTemplateOpening
          annotationTemplate={annotation}
          onChange={handleTypeChange}
        />
      </Box>

      {openingType === "DOOR" && (
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
              {"Sens d'ouverture"}
            </Typography>
            <KeyBadge>Tab</KeyBadge>
            <ToggleButtonGroup
              value={doorHinge}
              exclusive
              onChange={handleHingeChange}
              size="small"
              sx={openingToggleGroupSx}
            >
              {HINGE_OPTIONS.map((o) => (
                <ToggleButton key={o.value} value={o.value}>
                  {o.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
              {"Côté d'ouverture"}
            </Typography>
            <KeyBadge>S</KeyBadge>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FlipIcon fontSize="small" />}
              onClick={handleFlipSide}
              sx={{ textTransform: "none", py: 0.25 }}
            >
              Inverser
            </Button>
          </Box>
        </WhiteSectionGeneric>
      )}
    </>
  );
}
