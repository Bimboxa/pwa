import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

// Subscribe to the cross-tab `navigateToWorldPoint` event. When it fires
// (each new `triggeredAt`), if the payload's basemap matches the 3D tab's
// current main basemap, pan the camera to the broadcast world point.
export default function useNavigateCameraOnEvent({ threedEditor, rendererIsReady }) {
  const navigate = useSelector((s) => s.threedEditor.navigateToWorldPoint);
  const baseMap = useMainBaseMap();
  const lastTriggeredAtRef = useRef(0);

  useEffect(() => {
    if (!rendererIsReady || !threedEditor || !navigate) return;
    const { baseMapId, worldX, worldY, worldZ, triggeredAt } = navigate;
    if (!triggeredAt || triggeredAt === lastTriggeredAtRef.current) return;
    lastTriggeredAtRef.current = triggeredAt;
    if (!baseMap || baseMap.id !== baseMapId) return;
    threedEditor.panCameraToWorldPoint({ x: worldX, y: worldY, z: worldZ });
  }, [navigate, rendererIsReady, threedEditor, baseMap]);
}
