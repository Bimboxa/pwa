import { useState } from "react";

import DialogAutoWalls from "Features/annotations/components/DialogAutoWalls";
import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";

import CommandButton from "../../components/CommandButton";

export default function ButtonAutoWalls({ command, ctx, state, hotkeyLabel }) {
  const [open, setOpen] = useState(false);

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
        <DialogAutoWalls
          open={open}
          onClose={() => setOpen(false)}
          accentColor={getAnnotationColor(ctx.selectedAnnotation) || "#6366F1"}
        />
      )}
    </>
  );
}
