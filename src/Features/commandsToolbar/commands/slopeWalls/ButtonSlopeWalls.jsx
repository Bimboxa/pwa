import { useState } from "react";

import DialogGenerateSlopeWalls from "Features/annotations/components/DialogGenerateSlopeWalls";
import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";

import CommandButton from "../../components/CommandButton";

export default function ButtonSlopeWalls({ command, ctx, state, hotkeyLabel }) {
  const [open, setOpen] = useState(false);
  const annotation = ctx.selectedAnnotation;

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
      {open && annotation && (
        <DialogGenerateSlopeWalls
          open={open}
          onClose={() => setOpen(false)}
          annotation={annotation}
          accentColor={getAnnotationColor(annotation) || "#6366F1"}
        />
      )}
    </>
  );
}
