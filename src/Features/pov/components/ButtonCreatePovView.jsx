import { Box, Button } from "@mui/material";
import { Add } from "@mui/icons-material";

import useEnterPovFraming from "../hooks/useEnterPovFraming";

// POV module, "browse" state (no capture frame): floating button at the bottom
// of the displayed editor that arms the frame + the save bar (ButtonSavePov).
// Sits exactly where the save bar falls back to, so the two swap in place.
export default function ButtonCreatePovView() {
  // strings

  const createS = "Créer une vue";

  // data

  const enterFraming = useEnterPovFraming();

  // handlers

  function handleClick() {
    enterFraming(null);
  }

  // render

  return (
    <Box
      sx={{
        position: "absolute",
        zIndex: 30,
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
      }}
    >
      <Button
        variant="contained"
        color="secondary"
        startIcon={<Add />}
        onClick={handleClick}
        sx={{ textTransform: "none", borderRadius: 2, px: 2.5 }}
      >
        {createS}
      </Button>
    </Box>
  );
}
