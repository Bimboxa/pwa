import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useArcifyAnnotation from "Features/annotations/hooks/useArcifyAnnotation";
import useArcifySelectedPoints from "Features/annotations/hooks/useArcifySelectedPoints";

import CommandButton from "../../components/CommandButton";
import { getArcifyPointsTarget } from "./arcifyCommand";

export default function ButtonArcify({ command, ctx, state, hotkeyLabel }) {
  const dispatch = useDispatch();
  const arcify = useArcifyAnnotation();
  const arcifyPoints = useArcifySelectedPoints();

  const pointsTarget = getArcifyPointsTarget(ctx);
  const label = pointsTarget ? "Simplifier en arc" : command.label;

  async function handleClick() {
    try {
      const res = pointsTarget
        ? await arcifyPoints(pointsTarget)
        : await arcify(ctx.selectedAnnotation);
      if (res?.changed) dispatch(clearSelection());
    } catch (e) {
      console.error("[arcify]", e);
    }
  }

  return (
    <CommandButton
      commandKey={command.key}
      label={label}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={state}
      onClick={handleClick}
    />
  );
}
