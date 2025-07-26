import { useDispatch, useSelector } from "react-redux";

import { triggerBaseMapsUpdate } from "../baseMapsSlice";

import createBaseMapService from "../services/createBaseMapService";

export default function useCreateBaseMap() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  return async (props) => {
    const baseMap = await createBaseMapService({
      projectId: props.projectId ?? projectId,
      name: props.name ?? props.imageFile.name,
      imageFile: props.imageFile,
    });
    dispatch(triggerBaseMapsUpdate());
    return baseMap;
  };
}
