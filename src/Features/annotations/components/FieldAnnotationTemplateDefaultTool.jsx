import { useState } from "react";

import { Box, Typography, ButtonBase, Menu, MenuItem } from "@mui/material";
import { KeyboardArrowDown } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// One-liner default-tool picker: a labelled row with a dropdown list of the
// available drawing tools, replacing the horizontal band of icons.
export default function FieldAnnotationTemplateDefaultTool({
  value,
  onChange,
  options = [],
}) {
  // data

  const selectedOption =
    options.find((option) => option.key === value) ?? options[0];

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // handlers

  function handleOpen(e) {
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleSelect(key) {
    onChange(key);
    setAnchorEl(null);
  }

  // render

  if (options.length === 0) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          Outil par défaut
        </Typography>
        <ButtonBase
          onClick={handleOpen}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            minWidth: 160,
            height: 32,
            px: 1,
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            color: "text.primary",
          }}
        >
          <Box sx={{ display: "flex", color: "text.secondary" }}>
            {selectedOption?.icon}
          </Box>
          <Typography
            variant="caption"
            sx={{ flex: 1, textAlign: "left", fontWeight: 500 }}
          >
            {selectedOption?.label}
          </Typography>
          <KeyboardArrowDown sx={{ fontSize: 16, opacity: 0.5 }} />
        </ButtonBase>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {options.map((option) => {
            const selected = option.key === selectedOption?.key;
            return (
              <MenuItem
                key={option.key}
                selected={selected}
                onClick={() => handleSelect(option.key)}
                sx={{
                  gap: 1,
                  color: selected ? "secondary.main" : "text.primary",
                }}
              >
                <Box sx={{ display: "flex", color: "inherit" }}>
                  {option.icon}
                </Box>
                <Typography variant="body2" sx={{ color: "inherit" }}>
                  {option.label}
                </Typography>
              </MenuItem>
            );
          })}
        </Menu>
      </Box>
    </WhiteSectionGeneric>
  );
}
