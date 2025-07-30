import { useEffect } from "react";

import useSelectedMainBaseMap from "./useSelectedMainBaseMap";

export default function useAutoLoadMainBaseMapInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  // BASE MAP

  const baseMap = useSelectedMainBaseMap();

  useEffect(() => {
    if (mapEditorIsReady && Boolean(baseMap?.id)) {
      mapEditor.loadMainBaseMap(baseMap);
    }
  }, [mapEditorIsReady, baseMap?.id]);

  // BASE MAP VIEW
}
