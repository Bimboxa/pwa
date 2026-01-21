import { useRef, useEffect } from "react";

import useFetchMasterProjects from "./useFetchMasterProjects";


export default function useInitFetchMasterProjects() {
  const loadingRef = useRef();

  const fetchMasterProjects = useFetchMasterProjects();

  useEffect(() => {
    const fetch = async () => {
      loadingRef.current = true;
      await fetchMasterProjects();
      loadingRef.current = false;
    };
    if (!loadingRef.current) fetch();
  }, []);
}
