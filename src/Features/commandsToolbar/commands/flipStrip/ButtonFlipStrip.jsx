import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import CommandButton from "../../components/CommandButton";

export default function ButtonFlipStrip({ command, ctx, state, hotkeyLabel }) {
  const updateAnnotation = useUpdateAnnotation();

  async function handleClick() {
    const a = ctx.selectedAnnotation;
    await updateAnnotation({
      id: a.id,
      stripOrientation: (a.stripOrientation ?? 1) * -1,
    });
  }

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
