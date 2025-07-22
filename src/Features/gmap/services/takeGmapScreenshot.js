const GOOGLE_STATIC_MAPS_API_KEY = "AIzaSyCZbEVpuUxtkyXo9gqa8ngGUWQSC-h858g";

function metersPerPixel(lat, zoom) {
  const earthCircumference = 40075016.686; // in meters
  return (
    (earthCircumference * Math.cos((lat * Math.PI) / 180)) /
    Math.pow(2, zoom + 8)
  );
}

export default async function takeGmapScreenshot({ gmap, gmapContainer }) {
  if (!gmap || !gmapContainer) return;
  const center = gmap.getCenter();
  const zoom = gmap.getZoom();
  const gmapTypeId = gmap.getMapTypeId();
  const lat = center.lat();
  const lng = center.lng();

  // Get the container's size
  const width = Math.round(gmapContainer.offsetWidth);
  const height = Math.round(gmapContainer.offsetHeight);
  // Google Static Maps API max size is 640x640 for free tier, 2048x2048 for premium
  const maxSize = 640;
  //const size = `${Math.min(width, maxSize)}x${Math.min(height, maxSize)}`;
  const size = `${width}x${height}`;

  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=${gmapTypeId}&key=${GOOGLE_STATIC_MAPS_API_KEY}`;

  // Fetch the image as a Blob
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch static map image");
  const blob = await response.blob();

  // Optionally, create a File object (for file inputs, etc.)
  const file = new File([blob], "gmap-screenshot.png", { type: blob.type });

  return {
    url,
    file,
    meterByPx: metersPerPixel(lat, zoom),
  };
}
