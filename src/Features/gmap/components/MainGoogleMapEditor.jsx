import { useState } from "react";

import { Box } from "@mui/material";
import GoogleMap from "./GoogleMap";
import LayersGoogleMap from "./LayersGoogleMap";
//import SearchGoogleMap from "./SearchGoogleMap";

export default function MainGoogleMapEditor() {
  // state

  const [gmap, setGmap] = useState(null);
  const [gmapContainer, setGmapContainer] = useState(null);

  return (
    <Box sx={{ width: 1, height: 1 }}>
      <GoogleMap
        onGmapChange={setGmap}
        onGmapContainerChange={setGmapContainer}
      />
      <LayersGoogleMap gmap={gmap} gmapContainer={gmapContainer} />
      {/*<Box
        sx={{ position: "absolute", bottom: "8px", left: "8px", zIndex: 1000 }}
      >
        <SearchGoogleMap />
      </Box>
      */}
    </Box>
  );
}
