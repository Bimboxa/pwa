import {useSelector} from "react-redux";

export default function useSelectedMap() {
  const clientId = useSelector((s) => s.maps.selectedMapClientId);
  const mapsMap = useSelector((s) => s.maps.mapsMap);

  const selectedMap = mapsMap[clientId];

  return selectedMap;
}
