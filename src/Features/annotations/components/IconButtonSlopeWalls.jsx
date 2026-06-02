import { useState } from "react";

import { IconButton, Tooltip } from "@mui/material";

import IconSlopeWall from "./IconSlopeWall";
import DialogGenerateSlopeWalls from "./DialogGenerateSlopeWalls";

export default function IconButtonSlopeWalls({ annotation, accentColor }) {
  // state

  const [open, setOpen] = useState(false);

  // render

  return (
    <>
      <Tooltip title="Parois de la pente">
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          sx={{
            color: "text.disabled",
            "&:hover": {
              color: accentColor,
              bgcolor: accentColor + "18",
            },
          }}
        >
          <IconSlopeWall fontSize="small" />
        </IconButton>
      </Tooltip>
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
