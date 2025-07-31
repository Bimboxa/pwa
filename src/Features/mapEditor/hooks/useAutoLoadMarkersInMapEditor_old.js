import { useEffect } from "react";

import { useSelector } from "react-redux";

import useMarkers from "Features/markers/hooks/useMarkers";

export default function useAutoLoadMarkersInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const loadedMainBaseMapId = useSelector(
    (s) => s.mapEditor.loadedMainBaseMapId
  );
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);
  const tempMarker = useSelector((s) => s.markers.tempMarker);

  const { value: markers, loading } = useMarkers({
    filterByMapId: loadedMainBaseMapId,
    filterByListingsIds: [selectedListingId],
  });

  useEffect(() => {
    if (mapEditorIsReady && loadedMainBaseMapId && !loading) {
      console.log("useAutoLoadMarkersInMapEditor", markers);
      // init
      let _markers = [...markers];
      // filter markers
      if (selectedEntityId) {
        _markers = _markers.filter(
          (m) => m.targetEntityId === selectedEntityId
        );
      }

      // add temp marker if exists
      if (tempMarker && tempMarker.mapId === loadedMainBaseMapId) {
        _markers.push(tempMarker);
      }
      mapEditor.loadMarkers(_markers);
    }
  }, [
    mapEditorIsReady,
    markers?.length,
    loadedMainBaseMapId,
    selectedListingId,
    selectedEntityId,
    loading,
    tempMarker?.createdAt,
  ]);
}
