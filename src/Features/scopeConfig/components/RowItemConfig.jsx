import {
  Box,
  IconButton,
  ListItem,
  ListItemButton,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import Tune from "@mui/icons-material/Tune";

// Inner row: the whole width is the click target, so the padding is what
// makes the list breathe.
const ROW_INNER_SX = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  width: 1,
  px: 1,
  py: 1,
  borderRadius: 1,
};

// Icon + label of a row. Disabled items dim both — the switch alone carries
// the state, the dimming just makes a scan of the list readable.
function RowContentConfig({ item }) {
  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          color: "text.secondary",
          opacity: item.checked ? 1 : 0.45,
          "& svg": { fontSize: 20 },
        }}
      >
        {item.icon}
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{ opacity: item.checked ? 1 : 0.45 }}
        >
          {item.label}
        </Typography>
        {item.caption && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            {item.caption}
          </Typography>
        )}
      </Box>
    </>
  );
}

// Right part of a row. The row itself is the click target, so the switch only
// DISPLAYS the state (`pointerEvents: none`): a live switch would toggle
// twice. The wrapper span stays interactive — it carries the tooltip.
function RowSwitchDisplay({ item }) {
  const control = (
    <Box component="span" sx={{ display: "inline-flex" }}>
      <Switch
        size="small"
        checked={item.checked}
        disabled={item.switchDisabled}
        sx={{ pointerEvents: "none" }}
      />
    </Box>
  );
  if (!item.switchTooltip) return control;
  return (
    <Tooltip title={item.switchTooltip} placement="left">
      {control}
    </Tooltip>
  );
}

// Settings shortcut, left of the switch: opens the item's own Configuration
// page. Its click must NOT reach the row button underneath, which toggles the
// item. Disabled while the item is off — the nav column only lists the
// enabled items, so its page would bounce right back here.
function RowSettingsButton({ item, onOpenSettings }) {
  return (
    <Tooltip title="Paramétrer" placement="top">
      <Box component="span" sx={{ display: "inline-flex" }}>
        <IconButton
          size="small"
          disabled={!item.checked}
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings(item.key);
          }}
        >
          <Tune sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Tooltip>
  );
}

// One row: handle (or pin) + icon + label + settings shortcut + switch. A
// click anywhere on it toggles the item, except on the drag handle and on the
// settings button — and except on a locked item, which is not a button at
// all: MUI's `disabled` would dim the whole row, while these entries are
// permanently ON, not unavailable.
export default function RowConfig({
  item,
  onToggle,
  onOpenSettings,
  handle,
  rowRef,
  style,
}) {
  const body = (
    <>
      {handle}
      <RowContentConfig item={item} />
      {onOpenSettings && (
        <RowSettingsButton item={item} onOpenSettings={onOpenSettings} />
      )}
      <RowSwitchDisplay item={item} />
    </>
  );

  return (
    <ListItem
      ref={rowRef}
      disableGutters
      disablePadding
      divider
      style={style}
      // MUI draws the divider on every item, the closing border of the
      // section is the white section's own edge
      sx={{ "&:last-of-type": { borderBottom: 0 } }}
    >
      {item.switchDisabled ? (
        <Box sx={ROW_INNER_SX}>{body}</Box>
      ) : (
        <ListItemButton sx={ROW_INNER_SX} onClick={() => onToggle(item.key)}>
          {body}
        </ListItemButton>
      )}
    </ListItem>
  );
}
