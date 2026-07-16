import { useState } from "react";

import { Button } from "@mui/material";
import { PhotoCamera } from "@mui/icons-material";

import usePovs from "../hooks/usePovs";
import useCreatePov from "../hooks/useCreatePov";

// Floating "Enregistrer la vue" button at the bottom of the POV viewer,
// shown over both the 2D and 3D editors (replaces the 3D bottom toolbar).
export default function ButtonSavePov() {
  // strings

  const saveS = "Enregistrer la vue";

  // data

  const povs = usePovs() ?? [];
  const createPov = useCreatePov();

  // state

  const [creating, setCreating] = useState(false);

  // handlers

  async function handleClick() {
    if (creating) return;
    setCreating(true);
    try {
      await createPov({
        lastSortIndex: povs[povs.length - 1]?.sortIndex ?? null,
      });
    } finally {
      setCreating(false);
    }
  }

  // render

  return (
    <Button
      variant="contained"
      startIcon={<PhotoCamera />}
      onClick={handleClick}
      disabled={creating}
      sx={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        textTransform: "none",
        boxShadow: 4,
      }}
    >
      {saveS}
    </Button>
  );
}
