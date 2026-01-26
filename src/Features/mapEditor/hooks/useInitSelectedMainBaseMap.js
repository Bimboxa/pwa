import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import getInitSelectedMainBaseMapId from "Features/init/services/getInitSelectedMainBaseMapId";
import { setSelectedBaseMapsListingId, setSelectedMainBaseMapId } from "../mapEditorSlice";

import db from "App/db/db";

export default function useInitSelectedMainBaseMap() {
  const dispatch = useDispatch();

  const initBaseMapId = getInitSelectedMainBaseMapId();

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  async function initAsync() {
    if (initBaseMapId) {
      const baseMap = await db.baseMaps.get(initBaseMapId);
      if (baseMap?.projectId === projectId) {
        dispatch(setSelectedMainBaseMapId(initBaseMapId));
        dispatch(setSelectedBaseMapsListingId(baseMap.listingId));
      }
    }
  }

  useEffect(() => {
    initAsync();
  }, [projectId, initBaseMapId]);
}
