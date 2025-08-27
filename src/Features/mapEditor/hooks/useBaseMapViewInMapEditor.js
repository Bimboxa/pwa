import useSelectedMainBaseMap from "./useSelectedMainBaseMap";

import BaseMapView from "Features/baseMapViews/js/BaseMapView";

export default function useBaseMapViewInMapEditor() {
  // data

  const baseMap = useSelectedMainBaseMap();

  return BaseMapView.createFromBaseMap({ baseMap });
}
