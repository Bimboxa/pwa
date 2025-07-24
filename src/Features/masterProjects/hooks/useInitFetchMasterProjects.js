import { useRef, useEffect } from "react";
import { useDispatch } from "react-redux";

import { setMasterProjectsItemsMap } from "../masterProjectsSlice";

import { fetchMasterProjectsService } from "../services/masterProjectsServices";

import parseRemoteToLocalMasterProjects from "../utils/parseRemoteToLocalMasterProjects";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useInitFetchMasterProjects() {
  const dispatch = useDispatch();
  const loadingRef = useRef();

  useEffect(() => {
    const fetch = async () => {
      loadingRef.current = true;
      const projects = await fetchMasterProjectsService();
      console.log("[EFFECT] fetch masterProjects: ", projects);
      loadingRef.current = false;
      dispatch(
        setMasterProjectsItemsMap(
          getItemsByKey(parseRemoteToLocalMasterProjects(projects, "id"))
        )
      );
    };
    if (!loadingRef.current) fetch();
  }, []);
}
