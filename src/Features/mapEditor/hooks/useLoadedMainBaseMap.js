import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import { useSelector } from "react-redux";

export default function useLoadedMainBaseMap() {
  const { value: maps } = useBaseMaps();
  const mapsMap = getItemsByKey(maps, "id");

  const loadedMainBaseMapId = useSelector(
    (s) => s.mapEditor.loadedMainBaseMapId
  );

  const loadedMainBaseMap = mapsMap[loadedMainBaseMapId];

  return loadedMainBaseMap;
}
