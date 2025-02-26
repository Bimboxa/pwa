import {useSelector} from "react-redux";

export default function useMarkers(options) {
  const filterByMapId = options?.filterByMapId;

  const markersMap = useSelector((s) => s.markers.markersMap);

  let markers = Object.values(markersMap);

  if (filterByMapId) {
    markers = markers.filter((m) => m.mapId === filterByMapId);
  }

  return markers;
}
