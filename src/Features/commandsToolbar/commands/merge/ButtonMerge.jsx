import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useMergeAnnotations from "Features/annotations/hooks/useMergeAnnotations";

import CommandButton from "../../components/CommandButton";
import { getMergeTarget } from "./mergeCommand";

export default function ButtonMerge({ command, ctx, state, hotkeyLabel }) {
  const dispatch = useDispatch();
  const mergeAnnotations = useMergeAnnotations();

  async function handleClick() {
    const target = getMergeTarget(ctx);
    if (!target) return;
    await mergeAnnotations(target.annotations, { shape: target.shape });
    dispatch(clearSelection());
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
