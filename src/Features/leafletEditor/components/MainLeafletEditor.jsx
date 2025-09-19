import { useEffect, useRef } from "react";

import L, { map } from "leaflet";
import "leaflet/dist/leaflet.css";

import useInitLoadGeoportailPlugin from "../hooks/useInitLoadGeoportailPlugin";

import { Box, Typography } from "@mui/material";

import { OrthoIGN, PlanIGN } from "../data/tileLayers";

export default function MainLeafletEditor() {
  console.log("[debug] MainLeafletEditor");
  // data

  const mapRef = useRef();
  const containerRef = useRef(); // Add container ref

  // init

  //useInitLoadGeoportailPlugin();

  useEffect(() => {
    if (mapRef.current) {
      console.log("[debug] mapRef.current", mapRef.current);
      return;
    }

    const mainMap = L.map("leafletMap", {
      zoom: 24,
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

  // Add resize observer effect
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (mapRef.current) {
        // Small delay to ensure DOM has updated
        setTimeout(() => {
          mapRef.current.invalidateSize();
        }, 0);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <Box
      ref={containerRef} // Add ref to the container
      sx={{ width: 1, height: 1, border: "1px solid red" }}
    >
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
