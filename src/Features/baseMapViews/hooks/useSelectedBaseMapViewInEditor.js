import { useSelector } from "react-redux";

import useBaseMapView from "./useBaseMapView";

export default function useSelectedBaseMapViewInEditor() {
  const id = useSelector((s) => s.baseMapViews.selectedBaseMapViewIdInEditor);

  return useBaseMapView({ id });
}
