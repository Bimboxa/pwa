import { useState } from "react";

import { Box } from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";

import IconSlopeWall from "./IconSlopeWall";
import ToolbarToolButton from "./ToolbarToolButton";
import DialogAutoWalls from "./DialogAutoWalls";

// "Parois auto": creates the vertical walls connecting the selected
// POLYGON/POLYLINE to its adjacent surfaces (the hook reads the selection).
// Same wall icon as IconButtonSlopeWalls, with a star badge marking the auto
// behavior.
export default function IconButtonAutoWalls({ accentColor }) {
  // state

  const [open, setOpen] = useState(false);

  // render

  return (
    <>
      <ToolbarToolButton
        icon={
          <Box sx={{ position: "relative", display: "inline-flex" }}>
            <IconSlopeWall fontSize="small" />
            <AutoAwesome
              sx={{ fontSize: 9, position: "absolute", top: -3, right: -4 }}
            />
          </Box>
        }
        label="Parois auto"
        onClick={() => setOpen(true)}
        accentColor={accentColor}
      />
      {open && (
        <DialogAutoWalls
          open={open}
          onClose={() => setOpen(false)}
          accentColor={accentColor}
        />
      )}
    </>
  );
}
