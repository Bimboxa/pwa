import useMaps from "Features/maps/hooks/useMaps";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import {useSelector} from "react-redux";

export default function useLoadedMainMap() {
  const {value: maps} = useMaps();
  const mapsMap = getItemsByKey(maps, "id");

  const loadedMainMapId = useSelector((s) => s.mapEditor.loadedMainMapId);

  const loadedMainMap = mapsMap[loadedMainMapId];

  return loadedMainMap;
}
