// Index { itemKey: Set(zones) } of a highlightable data array (CONCEPTS,
// APP_COMPONENTS), children included, plus the reverse index
// { zone: firstOwnerKey } used when a zone of the diagram is clicked.
export default function getZonesByKey(items) {
  const zonesByKey = {};
  const keyByZone = {};

  function index(item) {
    zonesByKey[item.key] = new Set(item.zones ?? []);
    for (const zone of item.zones ?? []) {
      if (!(zone in keyByZone)) keyByZone[zone] = item.key;
    }
    for (const child of item.children ?? []) index(child);
  }
  for (const item of items) index(item);

  return { zonesByKey, keyByZone };
}
