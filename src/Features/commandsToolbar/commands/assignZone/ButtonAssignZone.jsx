import { useState } from "react";

import { CircularProgress } from "@mui/material";

import useAssignZoneToAnnotations from "Features/zonings/hooks/useAssignZoneToAnnotations";

import CommandButton from "../../components/CommandButton";

export default function ButtonAssignZone({ command, ctx, state, hotkeyLabel }) {
  const { assignZone } = useAssignZoneToAnnotations();
  const [running, setRunning] = useState(false);

  async function handleClick() {
    if (running) return;
    setRunning(true);
    try {
      await assignZone(ctx.selectedAnnotation);
    } finally {
      setRunning(false);
    }
  }

  return (
    <CommandButton
      commandKey={command.key}
      label={command.label}
      Icon={running ? () => <CircularProgress size={16} /> : command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={running ? { ...state, enabled: false } : state}
      onClick={handleClick}
    />
  );
}
