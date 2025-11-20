// point1: { lat, long }, point2: { lat, long }
export default function latLongToLength(point1, point2) {
  if (!point1 || !point2) return 0;

  const { lat: lat1, long: lon1 } = point1;
  const { lat: lat2, long: lon2 } = point2;

  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    return 0;
  }

  const earthRadius = 6378137; // meters (WGS84)
  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}
