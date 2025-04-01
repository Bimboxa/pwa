import {useEffect} from "react";

import {useSelector} from "react-redux";

import useMarkers from "Features/markers/hooks/useMarkers";

export default function useAutoLoadMarkersInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const loadedMainMapId = useSelector((s) => s.mapEditor.loadedMainMapId);
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);

  const {value: markers, loading} = useMarkers({
    filterByMapId: loadedMainMapId,
    filterByListingsIds: [selectedListingId],
  });
  console.log("markers", markers, loadedMainMapId, selectedListingId);

  useEffect(() => {
    if (mapEditorIsReady && loadedMainMapId && !loading) {
      console.log("useAutoLoadMarkersInMapEditor", markers);
      mapEditor.loadMarkers(markers);
    }
  }, [
    mapEditorIsReady,
    markers?.length,
    loadedMainMapId,
    selectedListingId,
    loading,
  ]);
}
