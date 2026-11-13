import { useState } from "react";

import { Box, ButtonBase, Popover, Switch, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ColorPickerContent from "Features/colors/components/ColorPickerContent";

import theme from "Styles/theme";

// OBJECT_3D template « Représentation 2D »: when enabled, the 2D top view of
// the object is painted in a flat color (template.color2D).
export default function FieldAnnotationTemplateColor2D({
  enabled,
  color,
  onChange,
}) {
  // strings

  const title = "Représentation 2D";
  const fillWithS = "Remplir avec";

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const defaultColor = theme.palette.secondary.main;
  const displayedColor = color || defaultColor;
  const open = Boolean(anchorEl);

  // handlers

  function handleEnabledChange(checked) {
    // Seed the color on first activation; switching off keeps it.
    onChange({ color2DEnabled: checked, color2D: color || defaultColor });
  }

  function handleColorChange(newColor) {
    onChange({ color2DEnabled: Boolean(enabled), color2D: newColor });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
        {title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {fillWithS}
        </Typography>
        <ButtonBase
          disabled={!enabled}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            bgcolor: displayedColor,
            border: "2px solid",
            borderColor: "divider",
            opacity: enabled ? 1 : 0.3,
          }}
        />
        <Switch
          size="small"
          checked={Boolean(enabled)}
          onChange={(e) => handleEnabledChange(e.target.checked)}
        />
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } },
        }}
      >
        <ColorPickerContent
          color={displayedColor}
          onColorChange={handleColorChange}
          onClose={() => setAnchorEl(null)}
        />
      </Popover>
    </WhiteSectionGeneric>
  );
}
