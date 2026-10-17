import useAddSlopeGuideLine from "Features/annotations/hooks/useAddSlopeGuideLine";

import CommandButton from "../../components/CommandButton";

export default function ButtonAddSlope({ command, ctx, state, hotkeyLabel }) {
  const addSlopeGuideLine = useAddSlopeGuideLine(ctx.selectedAnnotation);

  return (
    <CommandButton
      commandKey={command.key}
      label={command.label}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={state}
      onClick={() => addSlopeGuideLine()}
    />
  );
}
