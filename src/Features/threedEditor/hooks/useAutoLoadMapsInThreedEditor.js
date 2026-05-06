import { useEffect } from "react";
import { useStore } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

export default function useAutoLoadMapsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  //const maps = useBaseMaps({widthSelected: true, filterByMapId: mapId});
  //const { value: baseMaps } = useBaseMaps({ filterByProjectId: projectId });

  const mainBaseMap = useMainBaseMap();
  const store = useStore();

  useEffect(() => {
    if (threedEditor?.loadMaps && mainBaseMap?.id) {
      const opacity = store.getState().threedEditor.baseMapOpacityIn3d;
      threedEditor.loadMaps([mainBaseMap], { opacity });
    }
  }, [rendererIsReady, mainBaseMap?.id]);
}
