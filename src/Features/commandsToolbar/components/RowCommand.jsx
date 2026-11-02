import {
  Box,
  Checkbox,
  IconButton,
  ListItem,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";

import CommandBadges from "./CommandBadges";

// One command of the « Commandes » dialog (left column): the whole row
// toggles the command in the right-click menu — the checkbox only displays
// the state. Icon + label, the editor / hotkey badges, and when the org
// provides a helper for the command (Data/<org>/commands/<KEY>.md) an « i »
// button opening it (onInfo, null otherwise — the button is then absent).
// `highlighted` = matches the search of the dialog (secondary.light band).
export default function RowCommand({
  command,
  checked,
  onToggle,
  onInfo = null,
  highlighted = false,
  indent = false,
}) {
  // strings

  const infoS = "Aide";

  // helpers

  const Icon = command.Icon;
  const renderedIcon = Icon ? <Icon /> : command.icon;

  // handlers

  // The row is a ListItemButton: the « i » click must not toggle the shortcut.
  function stop(e) {
    e.stopPropagation();
  }

  function handleInfo(e) {
    e.stopPropagation();
    onInfo?.(command.key);
  }

  // render

  return (
    <ListItem
      disableGutters
      disablePadding
      divider
      sx={{ "&:last-of-type": { borderBottom: 0 } }}
    >
      <ListItemButton
        dense
        onClick={() => onToggle(command.key)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 0.5,
          pl: indent ? 3 : 1,
          borderRadius: 1,
          ...(highlighted && {
            bgcolor: "secondary.light",
            "&:hover": { bgcolor: "secondary.light" },
          }),
        }}
      >
        <Checkbox
          size="small"
          checked={checked}
          sx={{ p: 0.25, pointerEvents: "none" }}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: checked ? "secondary.main" : "text.secondary",
            "& .MuiSvgIcon-root": { fontSize: 18 },
          }}
        >
          {renderedIcon}
        </Box>
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, minWidth: 0, opacity: checked ? 1 : 0.8 }}
        >
          {command.label}
        </Typography>
        <CommandBadges command={command} />
        {onInfo && (
          <Tooltip title={infoS} enterDelay={400}>
            <IconButton
              size="small"
              aria-label={infoS}
              onMouseDown={stop}
              onClick={handleInfo}
              sx={{ p: 0.25, color: "text.secondary" }}
            >
              <InfoOutlined sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </ListItemButton>
    </ListItem>
  );
}
