import { useState } from "react";

import { Chip, Menu, MenuItem, Tooltip } from "@mui/material";
import { ArrowDropDown } from "@mui/icons-material";

// Compact option selector: a chip showing the selected option label, with a
// small drop-down arrow opening the options menu. `label` (the field name)
// is only shown as a tooltip.
export default function ChipOptionKey({
  value,
  label,
  onChange,
  valueOptions = [],
}) {
  // strings

  const placeholderS = "Choisir";

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const selectedOption = valueOptions.find(({ key }) => key === value);
  const chipLabel = selectedOption?.label ?? placeholderS;

  // handlers

  function handleSelect(option) {
    setAnchorEl(null);
    if (option.key !== value) onChange(option.key);
  }

  // render

  return (
    <>
      <Tooltip title={label ?? ""}>
        <Chip
          size="small"
          variant="outlined"
          label={chipLabel}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          onDelete={(e) =>
            setAnchorEl(e.currentTarget.closest(".MuiChip-root"))
          }
          deleteIcon={<ArrowDropDown />}
          sx={{
            flexShrink: 0,
            maxWidth: 160,
            "& .MuiChip-deleteIcon": { color: "text.secondary", ml: -0.75 },
          }}
        />
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {valueOptions.map((option) => (
          <MenuItem
            key={option.key}
            dense
            selected={option.key === value}
            onClick={() => handleSelect(option)}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
