import { useCallback, useEffect, useRef } from "react";

import L, { map } from "leaflet";
import "leaflet/dist/leaflet.css";

import { Box, Button, Paper } from "@mui/material";

import {
  OpenStreetMapCors,
  OrthoIGN,
  PlanIGN,
  EsriWorldImagery,
} from "../data/tileLayers";
import getImageFromElement from "../../misc/utils/getImageFromElement";
import ButtonCreateBaseMapFromLeaflet from "./ButtonCreateBaseMapFromLeaflet";
import SectionSearchAddress from "./SectionSearchAddress";

export default function MainLeafletEditor() {
  console.log("[debug] MainLeafletEditor");
  // data

  const mapRef = useRef();
  const containerRef = useRef(); // Add container ref

  // handler

  const handleLatLongChange = useCallback((lat, lng) => {
    if (!lat || !lng || !mapRef.current) return;

    mapRef.current.flyTo([lat, lng], mapRef.current.getZoom(), {
      animate: true,
      duration: 1.5,
    });
  }, []);

  // init

  //useInitLoadGeoportailPlugin();

  useEffect(() => {
    if (mapRef.current) {
      console.log("[debug] mapRef.current", mapRef.current);
      return;
    }

    const mainMap = L.map("leafletMap", {
      zoom: 19,
      center: [48.683619, 2.192905],
      layers: [OrthoIGN],
      zoomControl: false,
      attributionControl: false,
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
          mapRef.current?.invalidateSize();
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
      sx={{
        width: 1,
        height: 1,
        border: "1px solid red",
        position: "relative",
      }}
    >
      <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 1000 }}>
        <Paper>
          <SectionSearchAddress onLatLongChange={handleLatLongChange} />
        </Paper>
      </Box>

      <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 1000 }}>
        <ButtonCreateBaseMapFromLeaflet mapRef={mapRef} />
      </Box>

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
