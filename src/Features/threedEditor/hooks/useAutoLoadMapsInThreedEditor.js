import { useEffect } from "react";
import { useSelector } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

export default function useAutoLoadMapsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  //const maps = useBaseMaps({widthSelected: true, filterByMapId: mapId});
  //const { value: baseMaps } = useBaseMaps({ filterByProjectId: projectId });

  const mainBaseMap = useMainBaseMap();

  useEffect(() => {
    if (threedEditor?.loadMaps && mainBaseMap?.id) {
      threedEditor.loadMaps([mainBaseMap]);
    }
  }, [rendererIsReady, mainBaseMap?.id]);
}
