import { useState } from "react";

import { IconButton, Menu, Box } from "@mui/material";
import { FormatColorFill as ColorIcon } from "@mui/icons-material";

import { CirclePicker } from "react-color";
import defaultColors from "Features/colors/data/defaultColors";

export default function FieldColorVariantToolbar({ value, onChange }) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // handlers

  function handleColorChange(color) {
    console.log("color", color.hex);
    onChange(color.hex);
    setAnchorEl(null);
  }

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ borderRadius: "8px", width: "32px", height: "32px" }}
      >
        <ColorIcon sx={{ color: value }} />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
        <Box sx={{ p: 2 }}>
          <CirclePicker
            onChange={handleColorChange}
            color={value}
            colors={defaultColors}
            circleSize={16}
            circleSpacing={9}
          />
        </Box>
      </Menu>
    </>
  );
}
