import { useState } from "react";

import CommandButton from "../../components/CommandButton";
import DialogClean from "./DialogClean";

// Toolbar button of « Nettoyer » (commandsToolbar): opens the confirmation
// dialog of the deleted-annotations purge.
export default function ButtonClean({ command, state, hotkeyLabel }) {
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
      {open && <DialogClean open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
