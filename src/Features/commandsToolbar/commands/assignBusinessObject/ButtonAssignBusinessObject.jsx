import { useState } from "react";

import { CircularProgress } from "@mui/material";

import useAssignBusinessObjectToAnnotations from "Features/businessObjects/hooks/useAssignBusinessObjectToAnnotations";

import CommandButton from "../../components/CommandButton";

export default function ButtonAssignBusinessObject({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  const { assignForAnnotation } = useAssignBusinessObjectToAnnotations();
  const [running, setRunning] = useState(false);

  async function handleClick() {
    if (running) return;
    setRunning(true);
    try {
      await assignForAnnotation(ctx.selectedAnnotation);
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
