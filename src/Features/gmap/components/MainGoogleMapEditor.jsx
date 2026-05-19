import { useState } from "react";

import { Box } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import GoogleMap from "./GoogleMap";
import LayerGoogleMap from "./LayerGoogleMap";

export default function MainGoogleMapEditor() {
  // data

  const appConfig = useAppConfig();
  const jsApiKey = appConfig?.features?.gmap?.jsApiKey;

  // state

  const [gmap, setGmap] = useState(null);
  const [gmapContainer, setGmapContainer] = useState(null);

  return (
    <Box sx={{ width: 1, height: 1 }}>
      <GoogleMap
        apiKey={jsApiKey}
        onGmapChange={setGmap}
        onGmapContainerChange={setGmapContainer}
      />
      {/* <LayersGoogleMap gmap={gmap} gmapContainer={gmapContainer} /> */}
      {/* <Box
        sx={{ position: "absolute", bottom: "8px", left: "8px", zIndex: 1000 }}
      >
        <SearchGoogleMap />
      </Box> */}
      <LayerGoogleMap gmap={gmap} gmapContainer={gmapContainer} />
    </Box>
  );
}
