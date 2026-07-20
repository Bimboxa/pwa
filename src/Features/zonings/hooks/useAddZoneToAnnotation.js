import { useDispatch } from "react-redux";

import { triggerRelsZoneAnnotationUpdate } from "../zoningsSlice";

import addZoneToAnnotationService from "../services/addZoneToAnnotationService";

export default function useAddZoneToAnnotation() {
  const dispatch = useDispatch();

  return async ({ annotation, zone }) => {
    const rel = await addZoneToAnnotationService({ annotation, zone });
    dispatch(triggerRelsZoneAnnotationUpdate());
    return rel;
  };
}
