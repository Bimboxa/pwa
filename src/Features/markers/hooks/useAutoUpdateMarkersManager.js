import { useEffect } from "react";

import { useSelector } from "react-redux";

import editor from "App/editor";

export default function useAutoUpdateMarkersManager() {
  /*
   * TEMP MARKER PROPS
   */

  const tempMarkerProps = useSelector((s) => s.markers.tempMarkerProps);

  useEffect(() => {
    if (editor.mapEditor?.markersManager) {
      editor.mapEditor.markersManager.tempMarkerProps = tempMarkerProps;
    }
  }, [tempMarkerProps?.updatedAt, editor?.mapEditor?.markersManager]);
}
