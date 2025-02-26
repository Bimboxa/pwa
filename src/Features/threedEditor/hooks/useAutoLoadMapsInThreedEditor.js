import {useEffect} from "react";

import useMaps from "Features/maps/hooks/useMaps";

export default function useAutoLoadMapsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const maps = useMaps({widthSelected: true});

  useEffect(() => {
    if (threedEditor?.loadMaps) {
      threedEditor.loadMaps(maps);
    }
  }, [rendererIsReady, maps.length]);
}
