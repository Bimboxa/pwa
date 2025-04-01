import {useSelector} from "react-redux";

import useMaps from "Features/maps/hooks/useMaps";

export default function useSelectedMap() {
  const id = useSelector((s) => s.maps.selectedMapId);
  const {value: maps} = useMaps();

  const selectedMap = maps?.find((map) => map.id === id);

  return selectedMap;
}
