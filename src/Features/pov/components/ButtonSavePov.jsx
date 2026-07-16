import { useState } from "react";
import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import { Button } from "@mui/material";
import { Add, Refresh } from "@mui/icons-material";

import usePovs from "../hooks/usePovs";
import useCreatePov from "../hooks/useCreatePov";
import useUpdatePovView from "../hooks/useUpdatePovView";

// Floating button at the bottom of the POV viewer, shown over both the 2D
// and 3D editors (replaces the 3D bottom toolbar). Creates a new POV, or —
// when a POV is selected — updates it with the displayed view.
export default function ButtonSavePov() {
  // strings

  const createS = "Créer une vue";
  const updateS = "Mettre à jour la vue";

  // data

  const povs = usePovs() ?? [];
  const createPov = useCreatePov();
  const updatePovView = useUpdatePovView();
  const selectedItem = useSelector(selectSelectedItem);

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  const selectedPov =
    selectedItem?.type === "POV"
      ? povs.find((p) => p.id === selectedItem.id)
      : null;

  // handlers

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      if (selectedPov) {
        await updatePovView(selectedPov);
      } else {
        await createPov({
          lastSortIndex: povs[povs.length - 1]?.sortIndex ?? null,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <Button
      variant="contained"
      color="secondary"
      startIcon={selectedPov ? <Refresh /> : <Add />}
      onClick={handleClick}
      disabled={busy}
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
      {selectedPov ? updateS : createS}
    </Button>
  );
}
