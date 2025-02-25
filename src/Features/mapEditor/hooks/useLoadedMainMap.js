import {useSelector} from "react-redux";

export default function useLoadedMainMap() {
  const mapsMap = useSelector((s) => s.maps.mapsMap);
  const loadedMainMapId = useSelector((s) => s.mapEditor.loadedMainMapId);

  const loadedMainMap = mapsMap[loadedMainMapId];

  return loadedMainMap;
}
