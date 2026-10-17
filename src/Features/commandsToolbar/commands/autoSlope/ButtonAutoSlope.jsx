import useApplyAutoSlope from "Features/annotations/hooks/useApplyAutoSlope";

import CommandButton from "../../components/CommandButton";

export default function ButtonAutoSlope({ command, ctx, state, hotkeyLabel }) {
  const applyAutoSlope = useApplyAutoSlope(ctx.selectedAnnotation);

  return (
    <CommandButton
      commandKey={command.key}
      label={command.label}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={state}
      onClick={() => applyAutoSlope()}
    />
  );
}
