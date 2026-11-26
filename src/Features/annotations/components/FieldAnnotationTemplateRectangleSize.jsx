import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import OverrideToggle from "./OverrideToggle";

import {
  RECTANGLE_LOCK_WIDTH_KEY,
  RECTANGLE_LOCK_HEIGHT_KEY,
} from "Features/rectangles/utils/getRectangleSizeLocks";

// Dimensions of a RECTANGLE template: Lx / Ly in metres, one padlock each.
// Locked = driven by the template for every annotation; unlocked = default
// value at placement (see getRectangleSizeLocks).
const ROWS = [
  { key: "width", label: "Lx", lockKey: RECTANGLE_LOCK_WIDTH_KEY },
  { key: "height", label: "Ly", lockKey: RECTANGLE_LOCK_HEIGHT_KEY },
];

export default function FieldAnnotationTemplateRectangleSize({
  templateId,
  size,
  onChange,
  overrideFields,
  onToggleOverride,
}) {
  // handlers

  function handleDimChange(key, value) {
    onChange({ ...(size ?? {}), [key]: value });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
        Dimensions
      </Typography>
      {ROWS.map(({ key, label, lockKey }) => (
        <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {label}
          </Typography>
          <FieldAnnotationHeight
            annotation={{ id: templateId, [key]: size?.[key] }}
            field={key}
            label=""
            onChange={(updated) => handleDimChange(key, updated[key])}
          />
          <OverrideToggle
            field={lockKey}
            overrideFields={overrideFields}
            onToggle={onToggleOverride}
          />
        </Box>
      ))}
    </WhiteSectionGeneric>
  );
}
