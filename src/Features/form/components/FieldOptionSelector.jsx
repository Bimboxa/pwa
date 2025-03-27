import {useState, useRef} from "react";

import {Menu, MenuItem, Box, Typography, Button} from "@mui/material";
import {ArrowDropDown as Down} from "@mui/icons-material";

export default function FieldOptionSelector({value, onChange, options}) {
  options = options ?? [];
  const arrowRef = useRef(null);

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const label = value?.label ?? "Choisir une option";

  // handlers

  function handleChange(option) {
    onChange(option);
  }

  return (
    <>
      <Box>
        <Button
          endIcon={<Down ref={arrowRef} />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          {label}
        </Button>
      </Box>
      <Menu
        anchorEl={arrowRef.current}
        open={open}
        onClose={() => setAnchorEl(null)}
      >
        {options.map((option) => (
          <MenuItem
            key={option.id}
            onClick={() => {
              handleChange(option);
              setAnchorEl(null);
            }}
          >
            <Typography>{option.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
