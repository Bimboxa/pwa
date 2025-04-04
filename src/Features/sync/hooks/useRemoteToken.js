import {useEffect, useState, useRef} from "react";
import useToken from "Features/auth/hooks/useToken";

import {useRemoteTokenData} from "../RemoteTokenDataContext";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

import getAccessTokenDropboxService from "Features/dropbox/services/getAccessTokenDropboxService";

export default function useRemoteToken(remoteContainer) {
  const {remoteTokenData, setRemoteTokenData} = useRemoteTokenData();
  console.log("[useRemoteToken] remoteContainer", remoteContainer?.service);

  const remoteContainerInState = useRemoteContainer();
  console.log(
    "[useRemoteToken] remoteContainerInState",
    remoteContainerInState?.service
  );
  if (!remoteContainer) remoteContainer = remoteContainerInState;

  const token = useToken();

  const [loading, setLoading] = useState(!Boolean(remoteTokenData));

  const isRefreshing = useRef(false);

  const refreshThreshold = 1000 * 60; // 1 minute in ms
  const timeUntillRefresh =
    remoteTokenData?.expiresAt - Date.now() - refreshThreshold;

  async function refreshToken() {
    try {
      if (isRefreshing.current || !remoteContainerInState) {
        setLoading(false);
        return;
      }
      console.log(
        "[useRemoteToken] refreshing token...",
        remoteContainer?.service
      );
      if (remoteContainer?.service === "DROPBOX") {
        const {clientId} = remoteContainer;
        const accessTokenDropbox = await getAccessTokenDropboxService({
          token,
          clientId,
        });
        const expiresAt = Date.now() + accessTokenDropbox?.expiresIn * 1000;
        setRemoteTokenData({...accessTokenDropbox, expiresAt});
        isRefreshing.current = false;
      }

      setLoading(false);
    } catch (e) {
      console.error("[useRemoteToken] Error refreshing token", e);
      setLoading(false);
    }
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
  }, [
    token,
    remoteTokenData?.expiresAt,
    remoteTokenData?.accessToken,
    remoteContainer?.service,
    remoteContainerInState?.service,
  ]);

  return {value: remoteTokenData?.accessToken, loading, remoteContainer};
}
