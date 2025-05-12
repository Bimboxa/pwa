import {useState, useEffect} from "react";
import useFetchRemoteOpenedProjects from "./useFetchRemoteOpenedProjects";
import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import fetchRemoteOpenedProjectsService from "../services/fetchRemoteOpenedProjectsService";

export default function useInitFetchRemoteOpenedProjects() {
  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  const [openedProjects, setOpenedProjects] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAsync = async () => {
    try {
      setLoading(true);
      const projects = await fetchRemoteOpenedProjectsService({
        accessToken,
        remoteContainer,
      });
      setOpenedProjects(projects);
      setLoading(false);
    } catch (e) {
      console.log("error", e);
    }
  };

  useEffect(() => {
    console.log("[EFFECT] useInitFetchRemote");
    if (accessToken) {
      fetchAsync();
    }
  }, [accessToken]);

  return {loading, value: openedProjects};
}
