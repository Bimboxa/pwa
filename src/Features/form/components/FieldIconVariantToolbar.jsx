import { useState } from "react";

import { IconButton, Menu, Box, Tooltip } from "@mui/material";
import { FormatColorFill as ColorIcon } from "@mui/icons-material";
import { grey } from "@mui/material/colors";

import SelectorMarkerIcon from "Features/markers/components/SelectorMarkerIcon";
import MarkerIcon from "Features/markers/components/MarkerIcon";

export default function FieldIconVariantToolbar({
  value,
  label,
  onChange,
  spriteImage,
  options,
}) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const fillColor = options?.fillColor ?? grey[500];

  // handlers

  function handleChange(iconKey) {
    onChange(iconKey);
    setAnchorEl(null);
  }

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            width: 32,
            height: 32,
            borderRadius: "8px",
          }}
        >
          <MarkerIcon
            iconKey={value}
            spriteImage={spriteImage}
            fillColor={fillColor}
            size={32}
            //square
          />
        </IconButton>
      </Tooltip>

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        sx={{ p: 0, m: 0 }}
      >
        <Box sx={{ width: 300 }}>
          <Box sx={{ display: "flex", justifyContent: "center", p: 1 }}>
            <SelectorMarkerIcon
              iconKey={value}
              onChange={handleChange}
              spriteImage={spriteImage}
              iconColor={fillColor}
            />
          </Box>
        </Box>
      </Menu>
    </>
  );
}
