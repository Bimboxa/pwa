import { useSelector, useDispatch } from "react-redux";

import { triggerMarkersUpdate } from "../markersSlice";

import createMarkerService from "../services/createMarkerService";

export default function useCreateMarker() {
  const dispatch = useDispatch();

  // data

  const _baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  return async ({ x, y, baseMapId, entityId }) => {
    await createMarkerService({
      x,
      y,
      baseMapId: baseMapId ?? _baseMapId,
      entityId,
    });
    dispatch(triggerMarkersUpdate());
  };
}
