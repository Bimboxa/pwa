import { useState, useRef } from "react";

import { Menu, MenuItem, Box, Typography, Button } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";

export default function FieldOptionKey({
  value,
  label,
  onChange,
  valueOptions,
}) {
  const options = valueOptions ?? [];
  const arrowRef = useRef(null);

  console.log("debug_1509 valueOptions", valueOptions);
  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const selectedOption = valueOptions?.find(({ key }) => value === key);
  const buttonLabel = selectedOption?.label ?? "Choisir une option";

  // handlers

  function handleChange(option) {
    onChange(option.key);
  }

  return (
    <>
      <Box
        sx={{
          p: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
          {label}
        </Typography>
        <Button
          endIcon={<Down ref={arrowRef} />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <Typography>{buttonLabel}</Typography>
        </Button>
      </Box>
      <Menu
        anchorEl={arrowRef.current}
        open={open}
        onClose={() => setAnchorEl(null)}
      >
        {options.map((option) => (
          <MenuItem
            key={option?.key}
            onClick={() => {
              handleChange(option);
              setAnchorEl(null);
            }}
          >
            <Typography>{option?.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
