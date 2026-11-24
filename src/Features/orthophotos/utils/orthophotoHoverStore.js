// Ids of the orthophotos under the cursor, shared between the stations layer
// (LayerOrthophotoStations, which computes them in its frame loop) and the
// floating panel (PopperOrthophoto grid). A tiny external store rather than
// Redux: the set is evaluated on every frame, subscribers are only notified
// when it actually changes (useSyncExternalStore on the joined key).

let hoveredKey = "";
const listeners = new Set();

export function setHoveredOrthophotoIds(ids) {
  const key = ids.length ? ids.join("|") : "";
  if (key === hoveredKey) return;
  hoveredKey = key;
  listeners.forEach((listener) => listener());
}

export function subscribeHoveredOrthophotoIds(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// "" when nothing is hovered, else the ids joined by "|".
export function getHoveredOrthophotoIdsKey() {
  return hoveredKey;
}
