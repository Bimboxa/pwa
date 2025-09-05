import useMainBaseMap from "./useMainBaseMap";

import BaseMapView from "Features/baseMapViews/js/BaseMapView";

export default function useBaseMapViewInMapEditor() {
  // data

  const baseMap = useMainBaseMap();

  return BaseMapView.createFromBaseMap({ baseMap });
}
