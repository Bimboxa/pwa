// Scale lock of a base map container (« cadenas d'échelle »): when locked the
// container can be moved and cropped but never stretched nor zoomed, so the
// printed scale stays the print zone's 1:N.
// Stored on `container.scaleLocked`; when unset, a container whose print zone
// carries a scale starts locked, a « libre » zone (no scale) starts unlocked.
export default function resolveContainerScaleLocked(container, printZone) {
  if (typeof container?.scaleLocked === "boolean") return container.scaleLocked;
  return Boolean(printZone?.scale > 0);
}
