import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import OverrideToggle from "./OverrideToggle";

import { getOpeningType } from "Features/annotations/utils/isOpeningAnnotation";
import {
  OPENING_TYPE_OPTIONS,
  openingToggleGroupSx,
} from "Features/annotations/constants/openingFieldOptions";

// Template field for OPENING shapes: the opening type (none / door / window)
// that seeds every opening drawn from the template. The padlock pushes the
// template value onto already-created openings (overrideFields).
export default function FieldAnnotationTemplateOpening({
  annotationTemplate,
  onChange,
  overrideFields,
  onToggleOverride,
  label = "Type d'ouverture",
}) {
  // data

  const openingType = getOpeningType(annotationTemplate);
  const showOverride = typeof onToggleOverride === "function";

  // handlers

  function handleChange(e, next) {
    if (next === null) return;
    onChange({ ...annotationTemplate, openingType: next });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {label}
        </Typography>
        <ToggleButtonGroup
          value={openingType}
          exclusive
          onChange={handleChange}
          size="small"
          sx={openingToggleGroupSx}
        >
          {OPENING_TYPE_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {showOverride && (
          <OverrideToggle
            field="openingType"
            overrideFields={overrideFields}
            onToggle={onToggleOverride}
          />
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
