import { Box, Typography, Button, IconButton, Switch } from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getAnnotationOffsetLineConfig, {
  isOffsetLineLocked,
  OFFSET_LINE_FIELDS,
} from "Features/annotations/utils/getAnnotationOffsetLineConfig";

import FieldsOffsetLine from "./FieldsOffsetLine";

// strings

const titleS = "Ligne de déport";
const lockTitleS = "Appliquer aux annotations déjà créées";
const resetS = "Réinit.";

// Template-level "Ligne de déport": read-time default of the annotations
// without their own value (see getAnnotationOffsetLineConfig); the padlock
// forces it on every one.
export default function FieldAnnotationTemplateOffsetLine({
  annotationTemplate,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
}) {
  // helpers

  const config = getAnnotationOffsetLineConfig(annotationTemplate);
  const showOverrides = typeof onOverrideFieldsChange === "function";
  const locked = isOffsetLineLocked(overrideFields);

  // handlers

  function handleChange(changes) {
    onChange({
      ...annotationTemplate,
      offsetLine: { ...(annotationTemplate?.offsetLine ?? {}), ...changes },
    });
  }

  function handleEnabledChange(e) {
    handleChange({ enabled: e.target.checked });
  }

  function handleReset() {
    onChange({ ...annotationTemplate, offsetLine: null });
  }

  function handleToggleOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = locked
      ? current.filter((f) => !OFFSET_LINE_FIELDS.includes(f))
      : Array.from(new Set([...current, ...OFFSET_LINE_FIELDS]));
    onOverrideFieldsChange(next);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {titleS}
          </Typography>
          <Switch
            size="small"
            checked={config.enabled}
            onChange={handleEnabledChange}
          />
          <Button size="small" onClick={handleReset}>
            {resetS}
          </Button>
          {showOverrides && (
            <IconButton
              size="small"
              onClick={handleToggleOverride}
              title={lockTitleS}
              sx={{ color: locked ? "primary.main" : "text.disabled" }}
            >
              {locked ? (
                <LockIcon fontSize="small" />
              ) : (
                <LockOpenIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </Box>

        {config.enabled && (
          <FieldsOffsetLine config={config} onChange={handleChange} />
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
