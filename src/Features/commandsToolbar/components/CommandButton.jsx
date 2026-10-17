import { memo } from "react";

import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Tooltip,
} from "@mui/material";

import { useCommandMenu } from "./CommandMenuContext";

// Shared button of every command of the unified toolbar (the former
// ToolbarToolButton of the annotation tools, generalised):
// - toolbar row (no CommandMenuContext): Tooltip + IconButton. The tooltip
//   says the label, or the disabled reason; a disabled button is wrapped in a
//   span so the tooltip still shows. `hotkeyLabel` hangs a small boxed letter
//   on the bottom-right corner.
// - inside a group menu (CommandMenuContext variant "menu"): MenuItem with
//   icon + label, `selected` when active.
// `onClick(event, anchor)`: `anchor` is the element a popup must anchor to —
// the button itself in the row, the group button in a menu.
// `Icon` is a component, `icon` an already built element (drawing shapes).
function CommandButton({
  commandKey,
  label,
  Icon,
  icon,
  hotkeyLabel,
  state,
  onClick,
  accentColor = "secondary.main",
  size = "small",
  sx,
}) {
  const menu = useCommandMenu();
  const isMenu = menu?.variant === "menu";

  // helpers

  const enabled = Boolean(state?.enabled);
  const active = Boolean(state?.active);
  const reason = state?.reason;
  const renderedIcon = Icon ? <Icon /> : icon;

  // handlers

  function handleClick(event) {
    if (isMenu) {
      menu.onItemClick?.(commandKey);
      menu.closeMenu?.();
      onClick?.(event, menu.anchorEl ?? event.currentTarget);
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
        disabled={!enabled}
        onClick={handleClick}
      >
        <ListItemIcon
          sx={{
            minWidth: 32,
            color: active ? accentColor : "inherit",
            "& .MuiSvgIcon-root": { fontSize: 18 },
          }}
        >
          {renderedIcon}
        </ListItemIcon>
        <ListItemText
          primary={label}
          secondary={!enabled && reason ? reason : undefined}
          slotProps={{
            primary: { variant: "body2" },
            secondary: { variant: "caption" },
          }}
        />
        {hotkeyLabel && (
          <Box
            component="span"
            sx={{
              ml: 1.5,
              px: "4px",
              minWidth: 16,
              height: 16,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "4px",
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
              color: "text.secondary",
            }}
          >
            {hotkeyLabel}
          </Box>
        )}
      </MenuItem>
    );
  }

  const title = enabled || !reason ? label : `${label} — ${reason}`;

  const button = (
    <IconButton
      size={size}
      onClick={handleClick}
      disabled={!enabled}
      sx={{
        position: "relative",
        // Square with rounded corners (not the round MUI default): the hover
        // / active background then reads as a tile of the toolbar.
        borderRadius: "8px",
        // Three states: available = secondary color, armed / toggled on =
        // inverted (secondary background, white icon), not relevant = grey.
        color: active ? "secondary.contrastText" : accentColor,
        bgcolor: active ? accentColor : "transparent",
        "& .MuiSvgIcon-root": { fontSize: 18 },
        "&:hover": {
          color: active ? "secondary.contrastText" : "secondary.dark",
          bgcolor: active ? "secondary.dark" : "action.hover",
        },
        "&.Mui-disabled": { color: "text.disabled", opacity: 0.6 },
        ...sx,
      }}
    >
      {renderedIcon}
      {hotkeyLabel && (
        <Box
          component="span"
          sx={{
            position: "absolute",
            right: -2,
            bottom: -2,
            px: "2px",
            minWidth: 12,
            height: 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "3px",
            bgcolor: "background.paper",
            fontSize: 8,
            fontWeight: 700,
            lineHeight: 1,
            color: "text.secondary",
            pointerEvents: "none",
          }}
        >
          {hotkeyLabel}
        </Box>
      )}
    </IconButton>
  );

  return (
    <Tooltip title={title} enterDelay={400}>
      {enabled ? button : <span>{button}</span>}
    </Tooltip>
  );
}

export default memo(CommandButton);
