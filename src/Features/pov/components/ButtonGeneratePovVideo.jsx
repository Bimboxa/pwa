import { useState } from "react";

import { Box, Button, Tooltip } from "@mui/material";
import { Movie } from "@mui/icons-material";

import DialogGeneratePovVideo from "./DialogGeneratePovVideo";
import usePovs from "../hooks/usePovs";

// POV drawer footer: opens the video generator. Only 3D views can be
// animated frame by frame (2D content is DOM/SVG), hence the 3D filter.
export default function ButtonGeneratePovVideo() {
  // strings

  const generateS = "Générer une vidéo";
  const disabledS = "Enregistrez au moins 2 points de vue 3D";

  // data

  const povs = usePovs() ?? [];

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const povs3d = povs.filter(
    (pov) => pov.viewerMode === "THREED" && pov.camera3d?.position
  );
  const excluded2dCount = povs.length - povs3d.length;
  const disabled = povs3d.length < 2;

  // render

  return (
    <Box sx={{ p: 1, borderTop: 1, borderColor: "divider" }}>
      <Tooltip title={disabled ? disabledS : ""}>
        <Box>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={<Movie />}
            disabled={disabled}
            onClick={() => setOpen(true)}
            sx={{ textTransform: "none" }}
          >
            {generateS}
          </Button>
        </Box>
      </Tooltip>

      {open && (
        <DialogGeneratePovVideo
          open={open}
          onClose={() => setOpen(false)}
          povs={povs3d}
          excluded2dCount={excluded2dCount}
        />
      )}
    </Box>
  );
}
