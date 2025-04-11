import {useEffect, useRef} from "react";

import L, {map} from "leaflet";
import "leaflet/dist/leaflet.css";

import useInitLoadGeoportailPlugin from "../hooks/useInitLoadGeoportailPlugin";

import {Box, Typography} from "@mui/material";

import {OrthoIGN, PlanIGN} from "../data/tileLayers";

export default function MainLeafletEditor() {
  console.log("[debug] MainLeafletEditor");
  // data

  const mapRef = useRef();

  // init

  //useInitLoadGeoportailPlugin();

  useEffect(() => {
    if (mapRef.current) {
      console.log("[debug] mapRef.current", mapRef.current);
      return;
    }

    const mainMap = L.map("leafletMap", {
      zoom: 18,
      center: [48.683619, 2.192905],
      //layers: [OrthoIGN, PlanIGN],
      layers: [OrthoIGN],
    });

    mapRef.current = mainMap;

    return () => {
      mainMap.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <Box sx={{width: 1, height: 1}}>
      <div
        id="leafletMap"
        style={{
          height: "100%",
          width: "100%",
          zIndex: 2,
        }}
      />
    </Box>
  );
}
