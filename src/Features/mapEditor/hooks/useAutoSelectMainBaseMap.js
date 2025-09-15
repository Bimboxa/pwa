import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import getInitSelectedMainBaseMapId from "Features/init/services/getInitSelectedMainBaseMapId";
import { setSelectedMainBaseMapId } from "../mapEditorSlice";

import useMainBaseMap from "./useMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

import db from "App/db/db";

export default function useAutoSelectMainBaseMap() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const { value: baseMaps } = useBaseMaps();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  console.log("debug_2707 baseMaps", baseMaps);

  useEffect(() => {
    if (
      baseMaps?.length > 0 &&
      (baseMap?.projectId !== projectId || !baseMap)
    ) {
      const baseMap0 = baseMaps[0];
      console.log("[AUTO] set baseMap to", baseMap0);
      dispatch(setSelectedMainBaseMapId(baseMap0?.id));
    }
  }, [projectId, baseMaps?.length, baseMap?.projectId]);
}
