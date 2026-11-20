import useAlignAnnotations from "Features/annotationAlign/hooks/useAlignAnnotations";

import CommandButton from "../../components/CommandButton";

import getAlignCommandTargets from "./getAlignCommandTargets";

export default function ButtonAlignAnnotations({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  // data

  const align = useAlignAnnotations();

  // handlers

  async function handleClick() {
    // command.key is the align mode
    await align(command.key, {
      targets: getAlignCommandTargets(ctx),
      allAnnotations: ctx.annotations,
    });
  }

  // render

  return (
    <CommandButton
      commandKey={command.key}
      label={command.label}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={state}
      onClick={handleClick}
    />
  );
}
