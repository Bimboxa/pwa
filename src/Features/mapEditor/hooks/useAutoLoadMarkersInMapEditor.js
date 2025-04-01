import {useEffect} from "react";

import {useSelector} from "react-redux";

import useMarkers from "Features/markers/hooks/useMarkers";

export default function useAutoLoadMarkersInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const loadedMainMapId = useSelector((s) => s.mapEditor.loadedMainMapId);
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);

  let {value: markers, loading} = useMarkers({
    filterByMapId: loadedMainMapId,
    filterByListingsIds: [selectedListingId],
  });

  useEffect(() => {
    if (mapEditorIsReady && loadedMainMapId && !loading) {
      console.log("useAutoLoadMarkersInMapEditor", markers);

      // filter markers
      if (selectedEntityId) {
        markers = markers.filter((m) => m.targetEntityId === selectedEntityId);
      }
      mapEditor.loadMarkers(markers);
    }
  }, [
    mapEditorIsReady,
    markers?.length,
    loadedMainMapId,
    selectedListingId,
    selectedEntityId,
    loading,
  ]);
}
