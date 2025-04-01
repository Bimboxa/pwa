import {useState, useEffect} from "react";

import appConfigAsync from "App/appConfigAsync";

export default function useRemoteProjectsContainers() {
  const [projectsContainers, setProjectsContainers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    appConfigAsync.then((appConfig) => {
      setLoading(false);
      setProjectsContainers(appConfig.remoteProjectsContainers);
    });
  }, []);

  return {value: projectsContainers, loading};
}
