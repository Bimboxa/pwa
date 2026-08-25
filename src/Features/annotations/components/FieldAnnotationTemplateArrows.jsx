import {
  Box,
  Typography,
  IconButton,
  InputBase,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ArrowBack,
  ArrowForward,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// CIRCULATION-specific fields — toggled as one group by the padlock.
const ARROW_FIELDS = ["arrowStep", "arrowRight", "arrowLeft"];

const toggleGroupSx = {
  flexShrink: 0,
  bgcolor: "action.hover",
  "& .MuiToggleButton-root": {
    border: "none",
    borderRadius: 1.5,
    px: 1,
    py: 0.25,
  },
};

const numberInputSx = {
  width: 72,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  px: 1,
  height: 28,
  fontSize: "0.8rem",
  "& input": { textAlign: "center", p: 0 },
};

// Single-line "Flèches" editor for CIRCULATION templates / annotations:
// step between arrows (meters) + which direction(s) are drawn.
// Same contract as FieldAnnotationTemplateLinearLayout.
export default function FieldAnnotationTemplateArrows({
  annotationTemplate,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  label = "Flèches",
}) {
  const {
    arrowStep = 3,
    arrowRight = true,
    arrowLeft = true,
  } = annotationTemplate ?? {};

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    ARROW_FIELDS.every((f) => overrideFields.includes(f));

  const directions = [
    ...(arrowLeft ? ["LEFT"] : []),
    ...(arrowRight ? ["RIGHT"] : []),
  ];

  // handlers

  function handleStepChange(raw) {
    const parsed = raw === "" ? "" : Number(raw);
    onChange({
      ...annotationTemplate,
      arrowStep:
        parsed === "" || !Number.isFinite(parsed) ? "" : Math.max(0, parsed),
    });
  }

  function handleDirectionsChange(e, next) {
    const list = Array.isArray(next) ? next : [];
    onChange({
      ...annotationTemplate,
      arrowLeft: list.includes("LEFT"),
      arrowRight: list.includes("RIGHT"),
    });
  }

  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !ARROW_FIELDS.includes(f))
      : Array.from(new Set([...current, ...ARROW_FIELDS]));
    onOverrideFieldsChange(next);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {label}
        </Typography>

        <InputBase
          type="number"
          value={arrowStep ?? ""}
          onChange={(e) => handleStepChange(e.target.value)}
          inputProps={{ min: 0, step: 0.5 }}
          endAdornment={
            <Typography variant="caption" color="text.secondary">
              m
            </Typography>
          }
          title="Pas entre deux flèches"
          sx={numberInputSx}
        />

        <ToggleButtonGroup
          value={directions}
          onChange={handleDirectionsChange}
          size="small"
          sx={toggleGroupSx}
        >
          <ToggleButton value="LEFT" title="Flèches vers la gauche">
            <ArrowBack fontSize="small" />
          </ToggleButton>
          <ToggleButton value="RIGHT" title="Flèches vers la droite">
            <ArrowForward fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        {showOverrides && (
          <IconButton
            size="small"
            onClick={handleToggleGlobalOverride}
            title="Appliquer ces réglages aux circulations déjà créées"
            sx={{ color: allLocked ? "primary.main" : "text.disabled" }}
          >
            {allLocked ? (
              <LockIcon fontSize="small" />
            ) : (
              <LockOpenIcon fontSize="small" />
            )}
          </IconButton>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
