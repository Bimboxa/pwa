import { useSelector } from "react-redux";

import { CircularProgress } from "@mui/material";

import CommandButton from "../../components/CommandButton";

import useRunDuplicatesDetection from "Features/duplicatesDetection/hooks/useRunDuplicatesDetection";

// Toolbar button of « Détection des doublons » (commandsToolbar): launches the
// async run on the context annotations (main base map), spinner while the
// worker runs (status in duplicatesDetectionSlice — the helper's « Relancer »
// shares it), inverted while a result is displayed. A click on a displayed
// result re-runs; the helper's « Quitter » / Esc closes it.
export default function ButtonDetectDuplicates({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  // data

  const status = useSelector((s) => s.duplicatesDetection.status);
  const run = useRunDuplicatesDetection();

  // helpers

  const running = status === "running";
  const buttonState = {
    ...state,
    enabled: state.enabled && !running,
    reason: running ? "Détection en cours…" : state.reason,
    active: status !== "idle",
  };

  // handlers

  function handleClick() {
    if (running) return;
    run(ctx.annotations, {
      meterByPx: ctx.meterByPx,
      baseMapId: ctx.baseMap?.id,
    });
  }

  // render

  return (
    <CommandButton
      commandKey={command.key}
      label={command.label}
      Icon={running ? undefined : command.Icon}
      icon={running ? <CircularProgress size={18} thickness={5} /> : undefined}
      hotkeyLabel={hotkeyLabel}
      state={buttonState}
      onClick={handleClick}
    />
  );
}
