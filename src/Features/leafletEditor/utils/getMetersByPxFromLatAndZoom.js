export default function getMetersByPxFromLatAndZoom() {
  const earthCircumference = 40075016.686; // in meters
  return (
    (earthCircumference * Math.cos((lat * Math.PI) / 180)) /
    Math.pow(2, zoom + 8)
  );
}
