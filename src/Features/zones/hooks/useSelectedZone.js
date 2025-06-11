import {useSelector} from "react-redux";

import useZonesTree from "./useZonesTree";
import getNodeById from "Features/tree/utils/getNodeById";

export default function useSelectedZone() {
  const zoneId = useSelector((s) => s.zones.selectedZoneId);

  const {value: zonesTree} = useZonesTree();

  const node = getNodeById(zoneId, zonesTree);

  return node;
}
