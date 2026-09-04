import {
  Box,
  Typography,
  Button,
  IconButton,
  InputBase,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import {
  DEFAULT_LABEL_STUB_LENGTH,
  DEFAULT_LABEL_STUB_MODE,
  LABEL_STUB_FIELDS,
  LABEL_STUB_MODES,
} from "Features/annotations/utils/getAnnotationLabelStubConfig";

// strings

const titleS = "Étiquette";
const stubS = "Déport horizontal";
const lockTitleS = "Appliquer aux étiquettes déjà créées";
const resetS = "Réinit.";

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

// Template-level label settings: leader stub length (screen px) + mode.
// Unset = app default (32 px, Fixe). The value is a read-time default for the
// annotations without their own value; the padlock forces it on every one.
export default function FieldAnnotationTemplateLabel({
  annotationTemplate,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
}) {
  // helpers

  const rawLength = annotationTemplate?.labelStubLength;
  const length =
    rawLength === null || rawLength === undefined || rawLength === ""
      ? DEFAULT_LABEL_STUB_LENGTH
      : rawLength;
  const mode = LABEL_STUB_MODES.includes(annotationTemplate?.labelStubMode)
    ? annotationTemplate.labelStubMode
    : DEFAULT_LABEL_STUB_MODE;

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    LABEL_STUB_FIELDS.every((f) => overrideFields.includes(f));

  // handlers

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

  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !LABEL_STUB_FIELDS.includes(f))
      : Array.from(new Set([...current, ...LABEL_STUB_FIELDS]));
    onOverrideFieldsChange(next);
  }

  function handleReset() {
    onChange({
      ...annotationTemplate,
      labelStubLength: null,
      labelStubMode: null,
    });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {titleS}
          </Typography>
          <Button size="small" onClick={handleReset}>
            {resetS}
          </Button>
          {showOverrides && (
            <IconButton
              size="small"
              onClick={handleToggleGlobalOverride}
              title={lockTitleS}
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

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {stubS}
          </Typography>
          <InputBase
            type="number"
            value={length ?? ""}
            onChange={(e) => handleLengthChange(e.target.value)}
            inputProps={{ min: 0, step: 1 }}
            endAdornment={
              <Typography variant="caption" color="text.secondary">
                px
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
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
