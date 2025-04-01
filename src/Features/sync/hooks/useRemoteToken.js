import {useEffect, useRef} from "react";
import useToken from "Features/auth/hooks/useToken";

import {useRemoteTokenData} from "../RemoteTokenDataContext";

import getAccessTokenDropboxService from "Features/dropbox/services/getAccessTokenDropboxService";

export default function useRemoteToken() {
  const {remoteTokenData, setRemoteTokenData} = useRemoteTokenData();
  const token = useToken();

  const isRefreshing = useRef(false);

  const refreshThreshold = 1000 * 60; // 1 minute in ms
  const timeUntillRefresh =
    remoteTokenData?.expiresAt - Date.now() - refreshThreshold;

  async function refreshToken() {
    if (isRefreshing.current) {
      return;
    }
    console.log("[useRemoteToken] refreshing token...");
    const accessTokenDropbox = await getAccessTokenDropboxService({token});
    const expiresAt = Date.now() + accessTokenDropbox?.expireIn * 1000;
    setRemoteTokenData({...accessTokenDropbox, expiresAt});

    isRefreshing.current = false;
  }

  useEffect(() => {
    if (
      (remoteTokenData?.expiresAt && token && timeUntillRefresh < 0) ||
      (!remoteTokenData?.accessToken && token)
    ) {
      refreshToken();
      console.log("[useRemoteToken] refreshing token...");
      isRefreshing.current = true;
    }
  }, [token, remoteTokenData?.expiresAt, remoteTokenData?.accessToken]);

  return remoteTokenData?.accessToken;
}
