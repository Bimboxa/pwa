import {
  Box,
  Checkbox,
  Chip,
  ListItem,
  ListItemButton,
  Typography,
} from "@mui/material";

// One command of the « Raccourcis » dialog (left column): the whole row
// toggles the command in the right-click menu — the checkbox only displays
// the state. Icon + label, the hotkey letter and the editor the command is
// restricted to (2D / 3D) when it is not available in both.
export default function RowShortcutCommand({
  command,
  checked,
  onToggle,
  indent = false,
}) {
  // helpers

  const Icon = command.Icon;
  const renderedIcon = Icon ? <Icon /> : command.icon;
  const hotkey = command.hotkey?.key ? command.hotkey.key.toUpperCase() : null;
  const editor =
    command.editors && command.editors.length === 1 ? command.editors[0] : null;

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
        {editor && (
          <Chip
            label={editor}
            size="small"
            variant="outlined"
            sx={{ height: 18, fontSize: 10, "& .MuiChip-label": { px: 0.75 } }}
          />
        )}
        {hotkey && (
          <Box
            component="span"
            sx={{
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
            {hotkey}
          </Box>
        )}
      </ListItemButton>
    </ListItem>
  );
}
