import { useRef, useEffect } from "react";

import { useSelector } from "react-redux";

import useDailyScopes from "./useDailyScopes";

export default function useInitFetchDailyScopes() {
  const loadingRef = useRef();

  const { dailyScopesDate, fetchDailyScopes } = useDailyScopes();

  const jwt = useSelector((s) => s.auth.jwt);
  const userProfile = useSelector((s) => s.auth.userProfile);

  useEffect(() => {
    const fetch = async () => {
      loadingRef.current = true;
      // Keep the day the user was consulting when coming back to the
      // dashboard; falls back to today when nothing was selected yet.
      await fetchDailyScopes(dailyScopesDate ?? undefined);
      loadingRef.current = false;
    };

    if (!loadingRef.current && jwt && userProfile) fetch();
  }, [jwt, userProfile]);
}
