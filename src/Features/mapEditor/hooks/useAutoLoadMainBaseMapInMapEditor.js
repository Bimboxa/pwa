import { useEffect } from "react";

import { useSelector } from "react-redux";

import useSelectedMainBaseMap from "./useSelectedMainBaseMap";

export default function useAutoLoadMainBaseMapInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const baseMap = useSelectedMainBaseMap();

  useEffect(() => {
    if (mapEditorIsReady && baseMap?.id) {
      mapEditor.loadMainBaseMap(baseMap);
    }
  }, [mapEditorIsReady, baseMap?.id]);
}
