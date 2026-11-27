import { useEffect, useState } from "react";

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

import {
  CIRCULATION_ARROW_DEFAULT_LENGTH_PT,
  CIRCULATION_ARROW_DEFAULT_OPACITY,
  CIRCULATION_ARROW_DEFAULT_WIDTH_RATIO,
} from "Features/annotations/utils/getCirculationArrowPath";

// CIRCULATION-specific fields — toggled as one group by the padlock.
const ARROW_FIELDS = [
  "arrowStep",
  "arrowRight",
  "arrowLeft",
  "arrowLength",
  "arrowWidthRatio",
  "arrowOpacity",
];

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

// Number input holding a local draft: the value is committed on blur (or
// Enter), not on every keystroke, so a half-typed number never reaches the
// template / annotation.
function ArrowNumberInput({ value, onCommit, unit, title, inputProps }) {
  // state

  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  // handlers

  function handleBlur() {
    if (String(draft) !== String(value ?? "")) onCommit(draft);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") e.target.blur();
  }

  // render

  return (
    <InputBase
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      inputProps={inputProps}
      endAdornment={
        <Typography variant="caption" color="text.secondary">
          {unit}
        </Typography>
      }
      title={title}
      sx={numberInputSx}
    />
  );
}

// Single-line "Flèches" editor for CIRCULATION templates / annotations:
// step between arrows (meters) + which direction(s) are drawn, then the
// glyph itself: length (page pt of the print zone), thickness (% of the band
// width) and opacity (independent from the band's stroke opacity).
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
    arrowLength = CIRCULATION_ARROW_DEFAULT_LENGTH_PT,
    arrowWidthRatio = CIRCULATION_ARROW_DEFAULT_WIDTH_RATIO,
    arrowOpacity = CIRCULATION_ARROW_DEFAULT_OPACITY,
  } = annotationTemplate ?? {};

  const arrowOpacityPercent =
    arrowOpacity === "" || arrowOpacity === null
      ? ""
      : Math.round(Number(arrowOpacity) * 100);

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

  function handleNumberChange(key, raw, { max } = {}) {
    const parsed = raw === "" ? "" : Number(raw);
    let value = "";
    if (parsed !== "" && Number.isFinite(parsed)) {
      value = Math.max(0, parsed);
      if (max !== undefined) value = Math.min(max, value);
    }
    onChange({ ...annotationTemplate, [key]: value });
  }

  function handleOpacityChange(raw) {
    const parsed = raw === "" ? "" : Number(raw);
    onChange({
      ...annotationTemplate,
      arrowOpacity:
        parsed === "" || !Number.isFinite(parsed)
          ? ""
          : Math.min(100, Math.max(0, parsed)) / 100,
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

        <ArrowNumberInput
          value={arrowStep ?? ""}
          onCommit={(raw) => handleStepChange(raw)}
          inputProps={{ min: 0, step: 0.5 }}
          unit="m"
          title="Pas entre deux flèches"
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

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Longueur / épaisseur / opacité
        </Typography>

        <ArrowNumberInput
          value={arrowLength ?? ""}
          onCommit={(raw) => handleNumberChange("arrowLength", raw)}
          inputProps={{ min: 0, step: 1 }}
          unit="pt"
          title="Longueur d'une flèche, en points sur la zone d'impression"
        />

        <ArrowNumberInput
          value={arrowWidthRatio ?? ""}
          onCommit={(raw) => handleNumberChange("arrowWidthRatio", raw)}
          inputProps={{ min: 0, step: 5 }}
          unit="%"
          title="Épaisseur de la flèche, en % de la largeur de la bande (bande en cm)"
        />

        <ArrowNumberInput
          value={arrowOpacityPercent}
          onCommit={(raw) => handleOpacityChange(raw)}
          inputProps={{ min: 0, max: 100, step: 10 }}
          unit="%"
          title="Opacité des flèches (l'opacité de la bande se règle sur le contour)"
        />
      </Box>
    </WhiteSectionGeneric>
  );
}
