import {useEffect} from "react";
import {useSelector} from "react-redux";

import useMaps from "Features/maps/hooks/useMaps";

export default function useAutoLoadMapsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const mapsUpdatedAt = useSelector((s) => s.maps.mapsUpdatedAt);
  const mapId = useSelector((s) => s.maps.selectedMapId);

  const maps = useMaps({widthSelected: true, filterByMapId: mapId});

  useEffect(() => {
    if (threedEditor?.loadMaps && maps?.length > 0) {
      threedEditor.loadMaps(maps);
    }
  }, [rendererIsReady, maps.length, mapsUpdatedAt, mapId]);
}
