import { useState, useRef, useEffect } from "react";

import { Menu, MenuItem, Box, Typography, Button } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";

import WhiteSectionGeneric from "./WhiteSectionGeneric";

export default function FieldOptionSelector({
  value,
  label,
  onChange,
  valueOptions = [],
  options,
}) {
  const arrowRef = useRef(null);

  // options

  const firstOptionByDefault = options?.firstOptionByDefault;
  const displayNone = options?.displayNone;
  const labelKey = options?.labelKey;
  const showAsSection = options?.showAsSection

  // use

  useEffect(() => {
    if (firstOptionByDefault && valueOptions?.length > 0) {
      onChange(valueOptions[0]);
    }
  }, [firstOptionByDefault, valueOptions?.length]);

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const buttonLabel = value?.[labelKey] ?? "Choisir une option";

  // handlers

  function handleChange(option) {
    onChange(option);
  }

  if (showAsSection) {
    return <>
      <WhiteSectionGeneric
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            {label}
          </Typography>
          <Button
            endIcon={<Down ref={arrowRef} />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            <Typography variant="button">{buttonLabel}</Typography>
          </Button>
        </Box>
      </WhiteSectionGeneric>
      <Menu
        anchorEl={arrowRef.current}
        open={open}
        onClose={() => setAnchorEl(null)}
      >
        {valueOptions.map((option) => (
          <MenuItem
            key={option?.id ?? option?.key}
            onClick={() => {
              handleChange(option);
              setAnchorEl(null);
            }}
          >
            <Typography>{option?.[labelKey]}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  }

  return (
    <>
      <Box
        sx={{
          ...(displayNone && { display: "none" }),
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
        {valueOptions.map((option) => (
          <MenuItem
            key={option?.id ?? option?.key}
            onClick={() => {
              handleChange(option);
              setAnchorEl(null);
            }}
          >
            <Typography>{option?.[labelKey]}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
