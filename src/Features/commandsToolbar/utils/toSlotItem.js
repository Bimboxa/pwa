import getCommandState from "./getCommandState";

// Hotkey badge of a command for the displayed editor (none when the letter
// belongs to another editor — « E » Évider 2D / Extruder 3D).
export function getHotkeyLabel(command, ctx) {
  const hotkey = command.hotkey;
  if (!hotkey?.key) return null;
  if (hotkey.editors && !hotkey.editors.includes(ctx.editor)) return null;
  // A letter shared by several commands (D = the last-used « Dessin » type)
  // is badged on the one that would fire.
  if (hotkey.showBadgeWhen && !hotkey.showBadgeWhen(ctx)) return null;
  return hotkey.key.toUpperCase();
}

// One slot item of a command: what CommandSlot / CommandGroupButton render
// (toolbar row, group menus, right-click shortcuts menu).
export default function toSlotItem(command, ctx, deps) {
  return {
    key: command.key,
    command,
    label: command.label,
    Icon: command.Icon,
    icon: command.icon,
    hotkeyLabel: getHotkeyLabel(command, ctx),
    state: getCommandState(command, ctx),
    Button: command.Button,
    run: () => command.run?.(ctx, deps),
  };
}
