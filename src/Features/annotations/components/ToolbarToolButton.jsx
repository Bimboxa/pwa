import {
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Tooltip,
} from "@mui/material";

import { useToolbarTools } from "./ToolbarToolsContext";

// Shared tool button used by every IconButtonXxx of the annotation toolbar.
// - Without ToolbarToolsContext: Tooltip + IconButton (toolbar row).
// - With ToolbarToolsContext (variant "menu"): MenuItem with icon + label.
// `onClick(event, anchor)`: `anchor` is the element a popup must anchor to —
// the button itself in the row, the "More" button when launched from the menu.
// `tooltip` overrides the tooltip text only (e.g. disabled reason); `label`
// feeds both the tooltip and the menu item text.
export default function ToolbarToolButton({
  icon,
  label,
  tooltip,
  onClick,
  accentColor,
  active = false,
  disabled = false,
}) {
  const ctx = useToolbarTools();
  const isMenu = ctx?.variant === "menu";

  // handlers

  function handleClick(event) {
    if (isMenu) {
      ctx.closeMenu?.();
      onClick?.(event, ctx.anchorEl ?? event.currentTarget);
    } else {
      onClick?.(event, event.currentTarget);
    }
  }

  // render

  if (isMenu) {
    return (
      <MenuItem
        dense
        selected={active}
        disabled={disabled}
        onClick={handleClick}
      >
        <ListItemIcon
          sx={{ minWidth: 32, color: active ? accentColor : "inherit" }}
        >
          {icon}
        </ListItemIcon>
        <ListItemText
          primary={label}
          slotProps={{ primary: { variant: "body2" } }}
        />
      </MenuItem>
    );
  }

  const button = (
    <IconButton
      size="small"
      onClick={handleClick}
      disabled={disabled}
      sx={{
        color: active ? accentColor : "text.disabled",
        bgcolor: active ? accentColor + "18" : "transparent",
        ...(accentColor && {
          "&:hover": {
            color: accentColor,
            bgcolor: accentColor + "18",
          },
        }),
      }}
    >
      {icon}
    </IconButton>
  );

  return (
    <Tooltip title={tooltip ?? label}>
      {disabled ? <span>{button}</span> : button}
    </Tooltip>
  );
}
