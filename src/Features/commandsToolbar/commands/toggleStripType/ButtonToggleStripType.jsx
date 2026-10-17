import useToggleAnnotationStripType from "Features/annotations/hooks/useToggleAnnotationStripType";

import CommandButton from "../../components/CommandButton";

export default function ButtonToggleStripType({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  const toggleStripType = useToggleAnnotationStripType();

  return (
    <CommandButton
      commandKey={command.key}
      label={command.label}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={state}
      onClick={() => toggleStripType(ctx.selectedAnnotation)}
    />
  );
}
