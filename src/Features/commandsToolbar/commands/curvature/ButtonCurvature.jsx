import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useCurvature from "Features/annotations/hooks/useCurvature";

import CommandButton from "../../components/CommandButton";
import { getTargets } from "../../utils/selectionCommandState";

export default function ButtonCurvature({ command, ctx, state, hotkeyLabel }) {
  const dispatch = useDispatch();
  const curvature = useCurvature();

  async function handleClick() {
    try {
      const res = await curvature(getTargets(ctx));
      if (res?.addedCount > 0) dispatch(clearSelection());
    } catch (e) {
      console.error("[curvature]", e);
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
