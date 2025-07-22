import { useRef, useEffect, useState } from "react";

import getMapsApiAsync from "../services/getMapsApiAsync";

export default function GoogleMap({ onGmapChange, onGmapContainerChange }) {
  const mapsRef = useRef();
  const mapInstanceRef = useRef(null);

  const mapRef = useRef(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    initMapAsync();

    async function initMapAsync() {
      if (!mapsRef.current) {
        const maps = await getMapsApiAsync();
        mapsRef.current = maps;
        setMapsLoaded(true);
      } else {
        setMapsLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    if (
      mapsLoaded &&
      mapsRef.current &&
      !mapInstanceRef.current &&
      mapRef.current
    ) {
      // Create the map
      const map = new mapsRef.current.Map(mapRef.current, {
        center: { lat: 48.683619, lng: 2.192905 }, // Default: Paris
        zoom: 18,
        fullscreenControl: false,
        mapTypeControl: false,
        mapTypeId: "satellite",
        tilt: 0,
      });
      mapInstanceRef.current = map;

      //
      onGmapChange(map);
      onGmapContainerChange(mapRef.current);
    }
  }, [mapsLoaded]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100vh",
        }}
      />
    </div>
  );
}
