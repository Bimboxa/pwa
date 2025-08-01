import { useEffect } from "react";

import useSelectedMainBaseMap from "./useSelectedMainBaseMap";
import useSelectedBaseMapViewInEditor from "Features/baseMapViews/hooks/useSelectedBaseMapViewInEditor";

export default function useAutoLoadBaseMapViewInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  // BASE MAP

  const baseMapView = useSelectedBaseMapViewInEditor();

  useEffect(() => {
    if (mapEditorIsReady && Boolean(baseMapView?.id)) {
      mapEditor.loadBaseMapView(baseMapView);
    }
  }, [mapEditorIsReady, baseMapView?.id]);

  // BASE MAP VIEW
}
