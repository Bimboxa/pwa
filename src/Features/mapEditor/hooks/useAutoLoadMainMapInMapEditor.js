import {useEffect} from "react";

import useSelectedMap from "Features/maps/hooks/useSelectedMap";

export default function useAutoLoadMainMapInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const map = useSelectedMap();
  console.log("debug_2105 map", map);

  useEffect(() => {
    if (mapEditorIsReady && map?.imageUrl) {
      console.log("[MapEditor] load main map");
      mapEditor.loadMainMap(map);
    }
  }, [mapEditorIsReady, map?.imageUrl]);
}
