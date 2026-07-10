import { useDispatch } from "react-redux";

import { setImageModeEnabled } from "../mapEditorSlice";

import { Button } from "@mui/material";
import { Close } from "@mui/icons-material";

// Floating "exit capture mode" button shown while image mode is active.
// Shared by the 2D (MAP) and 3D (THREED) viewers.
export default function ButtonCloseImageMode() {
  const dispatch = useDispatch();

  return (
    <Button
      data-capture-hide
      variant="contained"
      color="secondary"
      size="small"
      startIcon={<Close />}
      onClick={() => dispatch(setImageModeEnabled(false))}
      sx={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        textTransform: "none",
        boxShadow: 3,
        // stays clickable when mounted inside a pointer-events:none wrapper
        // (3D overlay container)
        pointerEvents: "auto",
      }}
    >
      Quitter le mode capture
    </Button>
  );
}
