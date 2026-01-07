import { useState, useRef } from "react";

import { Menu, MenuItem, Box, Typography, Button } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";

export default function FieldOptionKey({
  value,
  label,
  onChange,
  valueOptions = [],
  options,
}) {
  const arrowRef = useRef(null);

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
          ...(options?.showAsSection
            ? {
              p: 1,
              borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            }
            : {}),
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
        <Button
          endIcon={<Down ref={arrowRef} />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <Typography variant="body2" noWrap>{buttonLabel}</Typography>
        </Button>
      </Box>
      <Menu
        anchorEl={arrowRef.current}
        open={open}
        onClose={() => setAnchorEl(null)}
      >
        {valueOptions.map((option) => (
          <MenuItem
            key={option?.key}
            onClick={() => {
              handleChange(option);
              setAnchorEl(null);
            }}
          >
            <Typography noWrap variant="body2">{option?.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
