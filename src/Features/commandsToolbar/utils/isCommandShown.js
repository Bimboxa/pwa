// Visibility of a command slot in the toolbar row (CommandsToolbar only — the
// group / right-click menus and the « Commandes » dialog never hide). One
// switch, « Masquer les commandes désactivées » (`hideDisabledCommands`):
// - off: every command is shown (the non-relevant ones disabled);
// - on: the toolbar follows the context — only the commands available in it
//   stay, and while at least one annotation is selected (2D or 3D — the
//   shared selection slice, `ctx.selectedAnnotationIds`) only the ones
//   tagged `usesSelection: true`.
// An armed command (`state.active`) is always shown so it can be toggled off.
export default function isCommandShown(item, ctx, { hideDisabledCommands }) {
  if (!hideDisabledCommands) return true;
  if (item.state?.active) return true;
  const hasSelection = ctx.selectedAnnotationIds.length > 0;
  if (hasSelection && !item.command.usesSelection) return false;
  return Boolean(item.state?.enabled);
}
