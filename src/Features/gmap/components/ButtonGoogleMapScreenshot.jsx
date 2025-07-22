import { useState } from "react";
import { Button } from "@mui/material";

// TODO: Replace with your actual Google Maps Static API key
const GOOGLE_STATIC_MAPS_API_KEY = "AIzaSyCZbEVpuUxtkyXo9gqa8ngGUWQSC-h858g";

function metersPerPixel(lat, zoom) {
  const earthCircumference = 40075016.686; // in meters
  return (
    (earthCircumference * Math.cos((lat * Math.PI) / 180)) /
    Math.pow(2, zoom + 8)
  );
}

export default function ButtonGoogleMapScreenshot({ map, mapContainerRef }) {
  // strings
  const takeScreenshotS = "Prendre une photo";

  // state
  const [meterByPx, setMeterByPx] = useState(null);
  const [mapImageFile, setMapImageFile] = useState(null);

  // handler
  function handleClick() {
    if (!map || !mapContainerRef?.current) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const mapTypeId = map.getMapTypeId();
    const lat = center.lat();
    const lng = center.lng();

    // Get the container's size
    const width = Math.round(mapContainerRef.current.offsetWidth);
    const height = Math.round(mapContainerRef.current.offsetHeight);
    // Google Static Maps API max size is 640x640 for free tier, 2048x2048 for premium
    const maxSize = 640;
    const size = `${Math.min(width, maxSize)}x${Math.min(height, maxSize)}`;

    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=${mapTypeId}&key=${GOOGLE_STATIC_MAPS_API_KEY}`;
    setMapImageFile(url);
    setMeterByPx(metersPerPixel(lat, zoom));
  }

  return (
    <div>
      <Button onClick={handleClick}>{takeScreenshotS}</Button>
      {mapImageFile && (
        <div style={{ marginTop: 16 }}>
          <img
            src={mapImageFile}
            alt="Map screenshot"
            style={{ maxWidth: "100%" }}
          />
          <div>Échelle : {meterByPx?.toFixed(2)} m/px</div>
        </div>
      )}
    </div>
  );
}
