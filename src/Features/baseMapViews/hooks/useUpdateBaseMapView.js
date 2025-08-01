import { useDispatch } from "react-redux";

import { triggerBaseMapViewsUpdate } from "../baseMapViewsSlice";
import updateBaseMapViewService from "../services/updateBaseMapViewService";

export default function useUpdateBaseMapView() {
  const dispatch = useDispatch();

  return async ({ updates }) => {
    await updateBaseMapViewService({ updates });
    dispatch(triggerBaseMapViewsUpdate());
  };
}
