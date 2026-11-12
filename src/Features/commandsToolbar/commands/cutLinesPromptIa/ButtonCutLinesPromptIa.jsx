import { useState } from "react";

import CommandButton from "../../components/CommandButton";
import DialogCutLinesPromptIa from "./DialogCutLinesPromptIa";

// Button of « Ligne de coupe – prompt IA »: opens the dialog. The dialog is
// mounted on opening only — it reads the 3D scene once, when it mounts.
export default function ButtonCutLinesPromptIa({
  command,
  deps,
  state,
  hotkeyLabel,
}) {
  // state

  const [open, setOpen] = useState(false);

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={state}
        onClick={() => setOpen(true)}
      />
      {open && (
        <DialogCutLinesPromptIa
          open={open}
          onClose={() => setOpen(false)}
          editor={deps.getThreedEditor()}
        />
      )}
    </>
  );
}
