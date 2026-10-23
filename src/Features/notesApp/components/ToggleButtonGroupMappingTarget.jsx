import { useState } from "react";

import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import { ArrowDropDown } from "@mui/icons-material";

export const LINK = "__LINK__";
export const IGNORE = "__IGNORE__";
const MENU = "__MENU__";

// Target picker of a notes-app mapping row: [link target | ▾ | Ignorer].
// The first button links the row to its current target (linkContent), the
// arrow opens a menu to pick another target (menuItems: {key, label, icon,
// selected}), the last one ignores the row.
export default function ToggleButtonGroupMappingTarget({
  value,
  linkContent,
  linkTooltip,
  ignoreLabel = "Ignorer",
  menuItems = [],
  onLink,
  onIgnore,
  onSelectMenuItem,
}) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // handlers

  function handleChange(e, v) {
    if (v === LINK) onLink?.();
    else if (v === IGNORE) onIgnore?.();
  }

  function handleMenuButtonClick(e) {
    // keeps the group value: the arrow only opens the menu
    e.preventDefault();
    setAnchorEl(e.currentTarget);
  }

  function handleSelect(key) {
    setAnchorEl(null);
    onSelectMenuItem?.(key);
  }

  // render

  return (
    <>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        onChange={handleChange}
        sx={{
          flexShrink: 0,
          "& .MuiToggleButton-root": {
            textTransform: "none",
            whiteSpace: "nowrap",
            py: 0.25,
            px: 1,
          },
        }}
      >
        <Tooltip title={linkTooltip ?? ""}>
          <ToggleButton value={LINK} sx={{ gap: 0.5, maxWidth: 240 }}>
            {linkContent}
          </ToggleButton>
        </Tooltip>
        <ToggleButton
          value={MENU}
          onClick={handleMenuButtonClick}
          sx={{ "&&": { px: 0 } }}
        >
          <ArrowDropDown fontSize="small" />
        </ToggleButton>
        <ToggleButton value={IGNORE}>{ignoreLabel}</ToggleButton>
      </ToggleButtonGroup>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {menuItems.map((item) => (
          <MenuItem
            key={item.key}
            dense
            selected={item.selected}
            onClick={() => handleSelect(item.key)}
          >
            {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
