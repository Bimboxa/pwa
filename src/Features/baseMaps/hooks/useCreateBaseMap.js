import { useDispatch, useSelector } from "react-redux";

import { triggerBaseMapsUpdate } from "../baseMapsSlice";

import createBaseMapService from "../services/createBaseMapService";

export default function useCreateBaseMap() {
  const dispatch = useDispatch();

  // data

  const _projectId = useSelector((s) => s.projects.selectedProjectId);

  // main

  return async ({ projectId, name, image, imageFile }) => {
    const baseMap = await createBaseMapService({
      projectId: projectId ?? _projectId,
      name: name ?? image?.name ?? imageFile.name,
      image,
      imageFile,
    });
    dispatch(triggerBaseMapsUpdate());
    return baseMap;
  };
}
