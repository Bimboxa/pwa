import { useState } from "react";

import IconSlopeWall from "./IconSlopeWall";
import ToolbarToolButton from "./ToolbarToolButton";
import DialogGenerateSlopeWalls from "./DialogGenerateSlopeWalls";

export default function IconButtonSlopeWalls({ annotation, accentColor }) {
  // state

  const [open, setOpen] = useState(false);

  // render

  return (
    <>
      <ToolbarToolButton
        icon={<IconSlopeWall fontSize="small" />}
        label="Parois de la pente"
        onClick={() => setOpen(true)}
        accentColor={accentColor}
      />
      {open && (
        <DialogGenerateSlopeWalls
          open={open}
          onClose={() => setOpen(false)}
          annotation={annotation}
          accentColor={accentColor}
        />
      )}
    </>
  );
}
