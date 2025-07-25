import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import PanelMainSelector from "Features/dashboard/components/PanelMainSelector";
import VerticalMenuDashboard from "Features/dashboard/components/VerticalMenuDashboard";

export default function LayersGoogleMap({ gmap, gmapContainer }) {
  // data

  const tpHeight = useSelector((s) => s.layout.topBarHeight);

  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "8px",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <VerticalMenuDashboard />
      </Box>

      <Box
        sx={{
          width: 300,
          position: "absolute",
          top: `${tpHeight + 8}px`,
          maxHeight: "600px",
          left: "56px",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PanelMainSelector gmap={gmap} gmapContainer={gmapContainer} />
      </Box>
    </>
  );
}
