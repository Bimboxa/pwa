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
  const tempMarker = useSelector((s) => s.markers.tempMarker);

  const {value: markers, loading} = useMarkers({
    filterByMapId: loadedMainMapId,
    filterByListingsIds: [selectedListingId],
  });

  useEffect(() => {
    if (mapEditorIsReady && loadedMainMapId && !loading) {
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
      if (tempMarker && tempMarker.mapId === loadedMainMapId) {
        _markers.push(tempMarker);
      }
      mapEditor.loadMarkers(_markers);
    }
  }, [
    mapEditorIsReady,
    markers?.length,
    loadedMainMapId,
    selectedListingId,
    selectedEntityId,
    loading,
    tempMarker?.createdAt,
  ]);
}
