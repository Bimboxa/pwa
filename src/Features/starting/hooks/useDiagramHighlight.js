import { useMemo, useState } from "react";

import getZonesByKey from "../utils/getZonesByKey";

// Highlight state of a diagram section (concepts, app skeleton): hover
// previews, click pins. Returns the Set of emphasized zones for the SVG and
// the handlers of the list / diagram.
export default function useDiagramHighlight(items) {
  // state

  const [selectedKey, setSelectedKey] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);

  // helpers

  const { zonesByKey, keyByZone } = useMemo(
    () => getZonesByKey(items),
    [items]
  );
  const highlightedKey = hoverKey ?? selectedKey;
  const highlightedZones = highlightedKey
    ? (zonesByKey[highlightedKey] ?? null)
    : null;

  // handlers

  function handleZoneClick(zone) {
    const key = keyByZone[zone];
    if (!key) return;
    setSelectedKey((prev) => (prev === key ? null : key));
  }

  return {
    selectedKey,
    highlightedKey,
    highlightedZones,
    onSelect: setSelectedKey,
    onHover: setHoverKey,
    onZoneClick: handleZoneClick,
  };
}
