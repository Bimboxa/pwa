import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedMainBaseMapId } from "../mapEditorSlice";

import useMainBaseMap from "./useMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

import db from "App/db/db";
import getInitSelectedMainBaseMapId from "Features/init/services/getInitSelectedMainBaseMapId";

export default function useAutoSelectMainBaseMap() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: baseMaps } = useBaseMaps({ filterByProjectId: projectId });
  const initBaseMapId = getInitSelectedMainBaseMapId();

  useEffect(() => {
    if (
      projectId &&
      baseMaps?.length > 0 &&
      (baseMap?.projectId && baseMap.projectId !== projectId || !initBaseMapId)
    ) {
      const baseMap0 = baseMaps[0];
      console.log("[AUTO] set baseMap to", baseMap?.projectId, projectId);
      dispatch(setSelectedMainBaseMapId(baseMap0?.id));
    }
  }, [projectId, baseMaps?.length, baseMap?.projectId, initBaseMapId]);
}
