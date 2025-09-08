import { useSelector } from "react-redux";

import { Paper } from "@mui/material";
import PanelCreateLocatedEntity from "Features/locatedEntities/components/PanelCreateLocatedEntity";

export default function LayerCreateLocatedEntity() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  console.log("enabledDrawingMode", enabledDrawingMode);

  if (!enabledDrawingMode) return null;

  return (
    <Paper
      sx={{
        position: "fixed",
        top: "8px",
        right: "8px",
        width: 300,
        zIndex: 10,
      }}
    >
      <PanelCreateLocatedEntity />
    </Paper>
  );
}
