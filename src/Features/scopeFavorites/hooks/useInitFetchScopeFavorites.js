import { useRef, useEffect } from "react";

import { useSelector } from "react-redux";

import useScopeFavorites from "./useScopeFavorites";

export default function useInitFetchScopeFavorites() {
  const loadingRef = useRef();

  const { fetchFavorites } = useScopeFavorites();

  const jwt = useSelector((s) => s.auth.jwt);
  const userProfile = useSelector((s) => s.auth.userProfile);

  useEffect(() => {
    const fetch = async () => {
      loadingRef.current = true;
      await fetchFavorites();
      loadingRef.current = false;
    };

    if (!loadingRef.current && jwt && userProfile) fetch();
  }, [jwt, userProfile]);
}
