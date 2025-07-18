import { useEffect } from "react";
import { useSelector } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

export default function useAutoLoadMapsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const baseMapId = useSelector((s) => s.mapEditor.selectedMainBaseMapId);

  //const maps = useBaseMaps({widthSelected: true, filterByMapId: mapId});
  const { value: baseMaps } = useBaseMaps();

  useEffect(() => {
    if (threedEditor?.loadMaps && baseMaps?.length > 0) {
      threedEditor.loadMaps(baseMaps);
    }
  }, [rendererIsReady, baseMaps?.length, baseMapId]);
}
