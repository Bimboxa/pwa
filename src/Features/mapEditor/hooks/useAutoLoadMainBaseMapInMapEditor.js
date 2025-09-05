import { useEffect } from "react";

import useMainBaseMap from "./useMainBaseMap";

export default function useAutoLoadMainBaseMapInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  // BASE MAP

  const baseMap = useMainBaseMap();

  useEffect(() => {
    if (mapEditorIsReady && Boolean(baseMap?.id)) {
      mapEditor.loadMainBaseMap(baseMap);
    }
  }, [mapEditorIsReady, baseMap?.id]);

  // BASE MAP VIEW
}
