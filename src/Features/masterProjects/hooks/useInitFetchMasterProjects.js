import { useRef, useEffect } from "react";

import { useSelector } from "react-redux";

import useFetchMasterProjects from "./useFetchMasterProjects";


export default function useInitFetchMasterProjects() {
  const loadingRef = useRef();

  const fetchMasterProjects = useFetchMasterProjects();

  const jwt = useSelector((state) => state.auth.jwt);
  const userProfile = useSelector((state) => state.auth.userProfile);

  useEffect(() => {
    const fetch = async () => {
      loadingRef.current = true;
      await fetchMasterProjects({ jwt, userProfile });
      loadingRef.current = false;
    };

    if (!loadingRef.current && jwt && userProfile) fetch();
  }, [jwt, userProfile]);
}
