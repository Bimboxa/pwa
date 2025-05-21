import {useState, useEffect} from "react";

import useRemoteProvider from "./useRemoteProvider";

import fetchRemoteOpenedProjectsService from "../services/fetchRemoteOpenedProjectsService";
import useRemoteContainer from "./useRemoteContainer";

export default function useInitFetchRemoteOpenedProjects() {
  const remoteProvider = useRemoteProvider();
  const remoteContainer = useRemoteContainer();

  const [openedProjects, setOpenedProjects] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAsync = async () => {
    try {
      setLoading(true);
      const projects = await fetchRemoteOpenedProjectsService({
        remoteProvider,
        remoteContainer,
      });
      setOpenedProjects(projects);
      setLoading(false);
    } catch (e) {
      console.log("error", e);
    }
  };

  const rpBoolean = Boolean(remoteProvider);
  useEffect(() => {
    console.log("[EFFECT] useInitFetchRemote");
    if (rpBoolean) {
      fetchAsync();
    }
  }, [rpBoolean]);

  return {loading, value: openedProjects};
}
