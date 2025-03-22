import {useEffect, useRef} from "react";
import useToken from "Features/auth/hooks/useToken";

import {useAccessToken} from "../AccessTokenDropboxContext";
import getAccessTokenDropboxService from "../services/getAccessTokenDropboxService";

export default function useAccessTokenDropbox() {
  const {accessToken, setAccessToken} = useAccessToken();
  const token = useToken();

  const isRefreshing = useRef(false);

  const refreshThreshold = 1000 * 60; // 1 minute in ms
  const timeUntillRefresh =
    accessToken?.expiresAt - Date.now() - refreshThreshold;

  async function refreshToken() {
    if (isRefreshing.current) {
      return;
    }
    console.log("[useAccessTokenDropbox] refreshing token...");
    const accessTokenDropbox = await getAccessTokenDropboxService({token});
    const expiresAt = Date.now() + accessTokenDropbox?.expireIn * 1000;
    setAccessToken({...accessTokenDropbox, expiresAt});

    isRefreshing.current = false;
  }

  useEffect(() => {
    if (
      (accessToken?.expiresAt && token && timeUntillRefresh < 0) ||
      (!accessToken?.accessToken && token)
    ) {
      refreshToken();
      isRefreshing.current = true;
    }
  }, [token, accessToken?.expiresAt, accessToken?.accessToken]);

  return accessToken?.accessToken;
}
