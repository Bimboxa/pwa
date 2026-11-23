import { useCallback, useMemo, useState } from "react";

import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import appTheme from "Styles/theme";

import CommandMenuContext from "Features/commandsToolbar/components/CommandMenuContext";
import CommandSlot from "Features/commandsToolbar/components/CommandSlot";

import { COMMANDS_BY_KEY } from "Features/commandsToolbar/commands";
import { COMMENT_COLORS } from "../commentsDarkTheme";
import useCommandsRuntime from "Features/commandsToolbar/hooks/useCommandsRuntime";
import toSlotItem, {
  getHotkeyLabel,
} from "Features/commandsToolbar/utils/toSlotItem";

// The button itself: icon + label of the command, its hotkey as a boxed
// letter at the right end, lit while the command is armed / toggled on, dimmed with its reason (tooltip + second line) while it
// cannot run. `interactive: false` (editor preview): inert, fully readable.
function CommandRow({
  label,
  icon,
  hotkeyLabel = null,
  enabled,
  active = false,
  reason = null,
  interactive = true,
  onClick,
}) {
  const disabled = !interactive || !enabled;
  const showReason = interactive && !enabled && Boolean(reason);

  return (
    <Tooltip title={showReason ? reason : ""} arrow placement="left">
      {/* span: a disabled button fires no pointer events for the tooltip */}
      <Box component="span" sx={{ display: "block" }}>
        <ButtonBase
          disabled={disabled}
          onClick={onClick}
          sx={{
            width: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 1,
            px: 1.25,
            py: 0.75,
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: active
              ? COMMENT_COLORS.accentText
              : COMMENT_COLORS.borderStrong,
            bgcolor: active
              ? COMMENT_COLORS.surfaceRaised
              : COMMENT_COLORS.surface,
            color: COMMENT_COLORS.text,
            textAlign: "left",
            transition: "border-color 0.12s, background-color 0.12s",
            "&:hover": {
              borderColor: COMMENT_COLORS.accentText,
              bgcolor: COMMENT_COLORS.surfaceRaised,
            },
            "&.Mui-disabled": { opacity: interactive ? 0.6 : 1 },
          }}
        >
          <Box
            sx={{
              flexShrink: 0,
              display: "flex",
              color: COMMENT_COLORS.accentText,
              "& .MuiSvgIcon-root": { fontSize: 20 },
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontSize: 13,
                fontWeight: 600,
                overflowWrap: "anywhere",
                color: COMMENT_COLORS.text,
              }}
            >
              {label}
            </Typography>
            {showReason && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontSize: 12,
                  color: COMMENT_COLORS.textSecondary,
                }}
              >
                {reason}
              </Typography>
            )}
          </Box>
          {hotkeyLabel && (
            <Box
              component="span"
              sx={{
                flexShrink: 0,
                px: "5px",
                minWidth: 20,
                height: 20,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${COMMENT_COLORS.borderStrong}`,
                borderRadius: "5px",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                color: COMMENT_COLORS.textSecondary,
              }}
            >
              {hotkeyLabel}
            </Box>
          )}
        </ButtonBase>
      </Box>
    </Tooltip>
  );
}

// COMMAND block of an info: a button firing one command of the commands
// toolbar (Features/commandsToolbar), as its toolbar button / right-click
// menu item would — same `getState` (so a command needing a selected
// annotation is disabled, with its reason, until one is selected), same
// `run` / popup-owning `Button`, on the toolbar's own ctx / deps
// (useCommandsRuntime). The command is rendered as a menu item
// (CommandMenuContext) drawn by CommandRow: it acts on the selection right
// away and anchors its popups on the block; those popups keep the app's
// light theme inside the dark info panel.
// No toolbar mounted (Viewer module, capture framing…) = unavailable, like
// the toolbar button. `interactive: false` (editor preview) keeps it inert.
export default function CommentBlockCommand({ block, interactive = true }) {
  // strings

  const missingS = "Commande introuvable";
  const unavailableS = "Commande indisponible dans ce module";

  // data

  const command = COMMANDS_BY_KEY[block.commandKey] ?? null;
  const runtime = useCommandsRuntime();

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const renderItem = useCallback(
    ({ label, icon, hotkeyLabel, enabled, active, reason, onClick }) => (
      <CommandRow
        label={label}
        icon={icon}
        hotkeyLabel={hotkeyLabel}
        enabled={enabled}
        active={active}
        reason={reason}
        onClick={onClick}
      />
    ),
    []
  );

  const menuCtx = useMemo(
    () => ({ variant: "menu", anchorEl, renderItem }),
    [anchorEl, renderItem]
  );

  // render

  if (!command) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {missingS}
      </Typography>
    );
  }

  const Icon = command.Icon;
  const icon = Icon ? <Icon /> : command.icon;

  if (!interactive || !runtime) {
    // the badge of the displayed editor when a toolbar is mounted, else the
    // command's own letter
    const hotkeyLabel = runtime
      ? getHotkeyLabel(command, runtime.ctx)
      : (command.hotkey?.key?.toUpperCase() ?? null);
    return (
      <CommandRow
        label={command.label}
        icon={icon}
        hotkeyLabel={hotkeyLabel}
        enabled={false}
        reason={unavailableS}
        interactive={interactive}
      />
    );
  }

  const { ctx, deps } = runtime;

  return (
    <Box ref={setAnchorEl}>
      <ThemeProvider theme={appTheme}>
        <CommandMenuContext.Provider value={menuCtx}>
          <CommandSlot
            item={toSlotItem(command, ctx, deps)}
            ctx={ctx}
            deps={deps}
          />
        </CommandMenuContext.Provider>
      </ThemeProvider>
    </Box>
  );
}
