import CommandButton from "./CommandButton";

// One slot of the toolbar (or of a group menu): a command that owns a popup /
// hooks renders its own `Button` component (receives ctx + state), every other
// command renders the generic CommandButton calling its pure `run`.
// Both forms never return null: a non-relevant command is disabled.
export default function CommandSlot({ item, ctx, deps }) {
  if (item.Button) {
    const Button = item.Button;
    return (
      <Button
        command={item.command}
        ctx={ctx}
        deps={deps}
        state={item.state}
        hotkeyLabel={item.hotkeyLabel}
      />
    );
  }
  return (
    <CommandButton
      commandKey={item.key}
      label={item.label}
      Icon={item.Icon}
      icon={item.icon}
      hotkeyLabel={item.hotkeyLabel}
      state={item.state}
      onClick={item.run}
    />
  );
}
