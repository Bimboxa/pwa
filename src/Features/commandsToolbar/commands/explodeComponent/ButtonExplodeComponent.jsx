import useExplodeComponents from "Features/annotationComponents/hooks/useExplodeComponents";

import CommandButton from "../../components/CommandButton";
import { getExplodeComponentTargets } from "./explodeComponentCommand";

// Toolbar button of « Éclater le composant » (commandsToolbar): detaches the
// generated annotations of the selected components, deletes the components
// and empties the selection — one undo step (useExplodeComponents).
export default function ButtonExplodeComponent({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  // data

  const explodeComponents = useExplodeComponents();

  // handlers

  async function handleClick() {
    try {
      await explodeComponents(getExplodeComponentTargets(ctx).map((a) => a.id));
    } catch (e) {
      console.error("[explodeComponent]", e);
    }
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
