import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useCleanSegments from "Features/annotations/hooks/useCleanSegments";

import CommandButton from "../../components/CommandButton";
import { getTargets } from "../../utils/selectionCommandState";

export default function ButtonCleanSegments({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  const dispatch = useDispatch();
  const cleanSegments = useCleanSegments();

  async function handleClick() {
    try {
      await cleanSegments(getTargets(ctx));
      dispatch(clearSelection());
    } catch (e) {
      console.error("[cleanSegments]", e);
    }
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
