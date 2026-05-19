import { useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

function metersPerPixel(lat, zoom) {
  const earthCircumference = 40075016.686; // in meters
  return (
    (earthCircumference * Math.cos((lat * Math.PI) / 180)) /
    Math.pow(2, zoom + 8)
  );
}

export default function ButtonGoogleMapScreenshot({ map, mapContainer }) {
  // strings
  const takeScreenshotS = "Prendre une photo";

  // data
  const appConfig = useAppConfig();
  const jsApiKey = appConfig?.features?.gmap?.jsApiKey;

  // state
  const [meterByPx, setMeterByPx] = useState(null);
  const [mapImageFile, setMapImageFile] = useState(null);

  // handler
  function handleClick() {
    if (!map || !mapContainer || !jsApiKey) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const mapTypeId = map.getMapTypeId();
    const lat = center.lat();
    const lng = center.lng();

    // Get the container's size
    const width = Math.round(mapContainer.offsetWidth);
    const height = Math.round(mapContainer.offsetHeight);
    // Google Static Maps API max size is 640x640 for free tier, 2048x2048 for premium
    const maxSize = 640;
    const size = `${Math.min(width, maxSize)}x${Math.min(height, maxSize)}`;

    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=${mapTypeId}&key=${jsApiKey}`;
    setMapImageFile(url);
    setMeterByPx(metersPerPixel(lat, zoom));
  }

  return (
    <div>
      <ButtonGeneric
        label={takeScreenshotS}
        onClick={handleClick}
        variant="contained"
        color="secondary"
      />
      {mapImageFile && (
        <div style={{ marginTop: 16, zIndex: 2 }}>
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
