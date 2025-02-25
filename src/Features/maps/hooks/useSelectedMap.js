import {useSelector} from "react-redux";

export default function useSelectedMap() {
  const id = useSelector((s) => s.maps.selectedMapId);
  const mapsMap = useSelector((s) => s.maps.mapsMap);

  const selectedMap = mapsMap[id];

  return selectedMap;
}
