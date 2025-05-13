import {useState, useEffect} from "react";
import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import fetchRemoteProjectScopesService from "../services/fetchRemoteProjectScopesService";

export default function useInitFetchRemoteProjectScopes({projectClientRef}) {
  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  const [scopes, setScopes] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAsync = async () => {
    try {
      setLoading(true);
      const scopes = await fetchRemoteProjectScopesService({
        accessToken,
        remoteContainer,
        projectClientRef,
      });
      setScopes(scopes);
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

  return {loading, value: scopes};
}
