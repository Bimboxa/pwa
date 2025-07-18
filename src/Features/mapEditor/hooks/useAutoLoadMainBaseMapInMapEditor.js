import { useEffect } from "react";

import { useSelector } from "react-redux";

import useSelectedMainBaseMap from "./useSelectedMainBaseMap";

export default function useAutoLoadMainBaseMapInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const baseMap = useSelectedMainBaseMap();
  const id = useSelector((s) => s.mapEditor.selectedMainBaseMapId);
  console.log("selectedBaseMap - v2", baseMap, mapEditorIsReady);

  useEffect(() => {
    if (mapEditorIsReady && baseMap?.imageUrl) {
      mapEditor.loadMainBaseMap(baseMap);
    }
  }, [mapEditorIsReady, baseMap?.imageUrl, id]);
}
