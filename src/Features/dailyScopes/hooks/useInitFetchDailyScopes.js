import { useRef, useEffect } from "react";

import { useSelector } from "react-redux";

import useDailyScopes from "./useDailyScopes";

export default function useInitFetchDailyScopes() {
  const loadingRef = useRef();

  const { fetchDailyScopes } = useDailyScopes();

  const jwt = useSelector((s) => s.auth.jwt);
  const userProfile = useSelector((s) => s.auth.userProfile);

  useEffect(() => {
    const fetch = async () => {
      loadingRef.current = true;
      await fetchDailyScopes();
      loadingRef.current = false;
    };

    if (!loadingRef.current && jwt && userProfile) fetch();
  }, [jwt, userProfile]);
}
