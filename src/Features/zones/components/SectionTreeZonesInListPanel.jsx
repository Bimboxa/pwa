import useZones from "../hooks/useZones";

import TreeZones from "./TreeZones";

export default function SectionTreeZonesInListPanel() {
  const zones = useZones();

  return <TreeZones items={zones} />;
}
