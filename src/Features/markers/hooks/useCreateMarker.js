import { useSelector } from "react-redux";

import createMarkerService from "../services/createMarkerService";

export default function useCreateMarker() {
  // data

  const _baseMapId = useSelector((s) => s.mapEditor.loadedMainBaseMapId);

  return async ({ x, y, baseMapId }) => {
    await createMarkerService({ x, y, baseMapId: baseMapId ?? _baseMapId });
  };
}
