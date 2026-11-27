import {
  Box,
  Typography,
  IconButton,
  Switch,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import InputNumberOnBlur from "Features/annotations/components/InputNumberOnBlur";

import {
  DEFAULT_LABEL_STUB_LENGTH,
  DEFAULT_LABEL_STUB_MODE,
  LABEL_STUB_FIELDS,
  LABEL_STUB_MODES,
} from "Features/annotations/utils/getAnnotationLabelStubConfig";
import {
  DEFAULT_ANNOTATION_LABEL_FONT_SIZE,
  getAnnotationLabelFontSize,
  LABEL_FONT_SIZE_FIELDS,
} from "Features/annotations/utils/getAnnotationLabelDisplay";
import getAnnotationLabelSizeConfig from "Features/annotations/utils/getAnnotationLabelSizeConfig";
import getAnnotationLabelFixedSizeConfig from "Features/annotations/utils/getAnnotationLabelFixedSizeConfig";

// strings

const titleS = "Étiquette";
const showLabelS = "Afficher l'étiquette";
const fontSizeS = "Taille du texte";
const stubS = "Déport horizontal";
const lockTitleS = "Appliquer aux annotations déjà créées";

const MODE_OPTIONS = [
  { value: "FIXED", label: "Fixe" },
  { value: "VARIABLE", label: "Variable" },
];

const toggleGroupSx = {
  flexShrink: 0,
  bgcolor: "action.hover",
  "& .MuiToggleButton-root": {
    border: "none",
    borderRadius: 1.5,
    px: 1,
    py: 0.25,
    fontSize: "0.7rem",
  },
};

const numberInputSx = {
  width: 64,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  px: 1,
  height: 28,
  fontSize: "0.8rem",
  "& input": { textAlign: "center", p: 0 },
};

const LABEL_SHOW_FIELDS = ["showLabel"];

// Template-level label settings, one padlock per row:
// - show label: default of the new annotations (seeded at creation);
// - text size, leader stub length + mode: read-time default of the
//   annotations without their own value. Unset = app default (14, 32, Fixe).
// A closed padlock (overrideFields) forces the row on every annotation.
// `isSubLabel`: label chip of a regular annotation — always fixed relative to
// the print zone, so sizes are in page pt. Otherwise (standalone LABEL
// template) the text size is owned by FieldAnnotationTemplateLabelSize and
// the stub unit follows the LABEL's own size mode.
export default function FieldAnnotationTemplateLabel({
  annotationTemplate,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  isSubLabel = true,
}) {
  // helpers

  const isFixedSize = isSubLabel
    ? getAnnotationLabelFixedSizeConfig().isFixedSize
    : getAnnotationLabelSizeConfig(annotationTemplate).isFixedSize;
  const unitS = isFixedSize ? "pt" : "px";

  // Resolved like an annotation without a template: own value ?? app default.
  const fontSize = getAnnotationLabelFontSize({
    labelFontSize: annotationTemplate?.labelFontSize,
  });

  const rawLength = annotationTemplate?.labelStubLength;
  const length =
    rawLength === null || rawLength === undefined || rawLength === ""
      ? DEFAULT_LABEL_STUB_LENGTH
      : rawLength;
  const mode = LABEL_STUB_MODES.includes(annotationTemplate?.labelStubMode)
    ? annotationTemplate.labelStubMode
    : DEFAULT_LABEL_STUB_MODE;

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const showLabel = annotationTemplate?.showLabel === true;

  function isLocked(fields) {
    return (
      Array.isArray(overrideFields) &&
      fields.every((f) => overrideFields.includes(f))
    );
  }

  // handlers

  function handleShowLabelChange(e) {
    onChange({ ...annotationTemplate, showLabel: e.target.checked });
  }

  function handleToggleOverride(fields) {
    const current = Array.isArray(overrideFields) ? overrideFields : [];
    onOverrideFieldsChange(
      isLocked(fields)
        ? current.filter((f) => !fields.includes(f))
        : Array.from(new Set([...current, ...fields]))
    );
  }

  function handleFontSizeChange(raw) {
    const parsed =
      raw === "" ? DEFAULT_ANNOTATION_LABEL_FONT_SIZE : Number(raw);
    onChange({
      ...annotationTemplate,
      labelFontSize:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_ANNOTATION_LABEL_FONT_SIZE,
    });
  }

  function handleLengthChange(raw) {
    const parsed = raw === "" ? 0 : Number(raw);
    onChange({
      ...annotationTemplate,
      labelStubLength: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
    });
  }

  function handleModeChange(e, newMode) {
    if (newMode !== null)
      onChange({ ...annotationTemplate, labelStubMode: newMode });
  }

  // render helpers

  function renderLock(fields) {
    if (!showOverrides) return null;
    const locked = isLocked(fields);
    return (
      <IconButton
        size="small"
        onClick={() => handleToggleOverride(fields)}
        title={lockTitleS}
        sx={{ color: locked ? "primary.main" : "text.disabled" }}
      >
        {locked ? (
          <LockIcon fontSize="small" />
        ) : (
          <LockOpenIcon fontSize="small" />
        )}
      </IconButton>
    );
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {titleS}
          </Typography>
        </Box>

        {isSubLabel && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {showLabelS}
            </Typography>
            <Switch
              size="small"
              checked={showLabel}
              onChange={handleShowLabelChange}
            />
            {renderLock(LABEL_SHOW_FIELDS)}
          </Box>
        )}

        {isSubLabel && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {fontSizeS}
            </Typography>
            <InputNumberOnBlur
              value={fontSize}
              onCommit={handleFontSizeChange}
              inputProps={{ min: 1, step: 1 }}
              endAdornment={
                <Typography variant="caption" color="text.secondary">
                  pt
                </Typography>
              }
              sx={numberInputSx}
            />
            {renderLock(LABEL_FONT_SIZE_FIELDS)}
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {stubS}
          </Typography>
          <InputNumberOnBlur
            value={length ?? ""}
            onCommit={handleLengthChange}
            inputProps={{ min: 0, step: 1 }}
            endAdornment={
              <Typography variant="caption" color="text.secondary">
                {unitS}
              </Typography>
            }
            sx={numberInputSx}
          />
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            size="small"
            sx={toggleGroupSx}
          >
            {MODE_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {renderLock(LABEL_STUB_FIELDS)}
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
