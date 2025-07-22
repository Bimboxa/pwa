import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import PanelMasterProjects from "Features/masterProjects/components/PanelMasterProjects";

export default function LayersGoogleMap({ gmap, gmapContainer }) {
  // data

  const tpHeight = useSelector((s) => s.layout.topBarHeight);

  return (
    <>
      <Box
        sx={{
          width: 300,
          position: "absolute",
          top: `${tpHeight + 8}px`,
          left: "16px",
        }}
      >
        <PanelMasterProjects gmap={gmap} gmapContainer={gmapContainer} />
      </Box>
    </>
  );
}
