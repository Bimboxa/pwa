import { useSelector, useDispatch } from "react-redux";

import { triggerMarkersUpdate } from "../markersSlice";

import createMarkerService from "../services/createMarkerService";

export default function useCreateMarker() {
  const dispatch = useDispatch();

  // data

  const _baseMapId = useSelector((s) => s.mapEditor.loadedMainBaseMapId);

  return async ({ x, y, baseMapId }) => {
    await createMarkerService({ x, y, baseMapId: baseMapId ?? _baseMapId });
    dispatch(triggerMarkersUpdate());
  };
}
