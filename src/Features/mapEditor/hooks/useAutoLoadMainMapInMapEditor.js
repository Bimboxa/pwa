import {useEffect} from "react";

import useSelectedMap from "Features/maps/hooks/useSelectedMap";

export default function useAutoLoadMainMapInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const map = useSelectedMap();
  console.log("[AutoLoad] map", map);

  useEffect(() => {
    if (mapEditorIsReady && map?.imageUrl) {
      mapEditor.loadMainMap(map);
    }
  }, [mapEditorIsReady, map?.imageUrl]);
}
