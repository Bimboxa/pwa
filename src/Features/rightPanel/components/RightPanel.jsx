import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import VerticalMenuRightPanel from "./VerticalMenuRightPanel";
import SectionCreateLocatedEntity from "Features/locatedEntities/components/SectionCreateLocatedEntity";

export default function RightPanel() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const width = 300;

  // helper

  const openCreatePanel = Boolean(enabledDrawingMode);

  return (
    <>
      {!openCreatePanel && <VerticalMenuRightPanel />}
      {openCreatePanel && (
        <Box sx={{ position: "relative", width: "64px" }}>
          <Box
            sx={{
              width: 300,
              bgcolor: "white",
              position: "absolute",
              top: "8px",
              left: 0,
              transform: "translateX(-100%)",
            }}
          >
            <SectionCreateLocatedEntity />
          </Box>
        </Box>
      )}
    </>
  );
}
