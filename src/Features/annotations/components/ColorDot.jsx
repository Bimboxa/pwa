import { useState } from "react";

import { Box, Popover } from "@mui/material";

import ColorPickerContent from "Features/colors/components/ColorPickerContent";

// Clickable color dot opening the shared brand color picker.
export default function ColorDot({ value, onChange, title, disabled }) {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <>
      <Box
        onClick={(e) => !disabled && setAnchorEl(e.currentTarget)}
        title={title}
        sx={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          bgcolor: value || "#fff",
          cursor: disabled ? "default" : "pointer",
          border: "2px solid",
          borderColor: "divider",
          opacity: disabled ? 0.4 : 1,
          flexShrink: 0,
          "&:hover": disabled ? {} : { transform: "scale(1.1)" },
          transition: "transform 0.2s",
        }}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } } }}
      >
        <ColorPickerContent
          color={value}
          onColorChange={onChange}
          onClose={() => setAnchorEl(null)}
        />
      </Popover>
    </>
  );
}
