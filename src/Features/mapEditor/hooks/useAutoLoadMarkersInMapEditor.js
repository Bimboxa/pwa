import {useEffect} from "react";

import {useSelector} from "react-redux";

import useMarkers from "Features/markers/hooks/useMarkers";

export default function useAutoLoadMarkersInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const loadedMainMapId = useSelector((s) => s.mapEditor.loadedMainMapId);

  const markers = useMarkers({
    filterByMapId: loadedMainMapId,
  });

  useEffect(() => {
    if (mapEditorIsReady && loadedMainMapId) {
      console.log("useAutoLoadMarkersInMapEditor", markers);
      mapEditor.loadMarkers(markers);
    }
  }, [mapEditorIsReady, markers.length, loadedMainMapId]);
}
