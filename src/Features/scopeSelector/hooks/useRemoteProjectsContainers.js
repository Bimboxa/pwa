import {useState, useEffect} from "react";

import appConfigAsync from "App/appConfigAsync";

export default function useRemoteProjectsContainers() {
  const [projectsContainers, setProjectsContainers] = useState([]);

  useEffect(() => {
    appConfigAsync.then((appConfig) => {
      setProjectsContainers(appConfig.remoteProjectsContainers);
    });
  }, []);

  return projectsContainers;
}
