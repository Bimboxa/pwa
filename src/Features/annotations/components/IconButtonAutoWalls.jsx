import { useState } from "react";

import { Box, IconButton, Tooltip } from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";

import IconSlopeWall from "./IconSlopeWall";
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
      <Tooltip title="Parois auto">
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
          <Box sx={{ position: "relative", display: "inline-flex" }}>
            <IconSlopeWall fontSize="small" />
            <AutoAwesome
              sx={{ fontSize: 9, position: "absolute", top: -3, right: -4 }}
            />
          </Box>
        </IconButton>
      </Tooltip>
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
