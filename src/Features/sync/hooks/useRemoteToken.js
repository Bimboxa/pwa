import {useEffect, useState, useRef} from "react";

import {useSelector} from "react-redux";

import useToken from "Features/auth/hooks/useToken";

import {useRemoteTokenData} from "../RemoteTokenDataContext";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

import getAccessTokenDropboxService from "Features/dropbox/services/getAccessTokenDropboxService";
import getSignedOutFromLocalStorage from "../services/getSignedOutFromLocalStorage";

export default function useRemoteToken(remoteContainer) {
  const {remoteTokenData, setRemoteTokenData} = useRemoteTokenData();

  const remoteContainerInState = useRemoteContainer();
  const signedOut = getSignedOutFromLocalStorage();

  if (!remoteContainer) remoteContainer = remoteContainerInState;

  const token = useToken();

  const [loading, setLoading] = useState(false);

  const isRefreshing = useRef(false);

  const refreshThreshold = 1000 * 60; // 1 minute in ms
  const timeUntillRefresh =
    remoteTokenData?.expiresAt - Date.now() - refreshThreshold;

  async function refreshToken() {
    try {
      if (isRefreshing.current || !remoteContainer) {
        //setLoading(false);
        return;
      }
      console.log(
        "[useRemoteToken] refreshing token...",
        remoteContainer?.service
      );
      if (remoteContainer?.service === "DROPBOX") {
        const {clientId} = remoteContainer;
        setLoading(true);
        const accessTokenDropbox = await getAccessTokenDropboxService({
          token,
          clientId,
        });
        const expiresAt = Date.now() + accessTokenDropbox?.expiresIn * 1000;
        setRemoteTokenData({...accessTokenDropbox, expiresAt});
        //
        isRefreshing.current = false;
        setLoading(false);
      }
    } catch (e) {
      console.error("[useRemoteToken] Error refreshing token", e);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      !signedOut &&
      ((remoteTokenData?.expiresAt && token && timeUntillRefresh < 0) ||
        (!remoteTokenData?.accessToken && token))
    ) {
      console.log("TRIGGER REFRESH TOKEN");
      refreshToken();
      isRefreshing.current = true;
    }
  }, [
    token,
    remoteTokenData?.expiresAt,
    remoteTokenData?.accessToken,
    remoteContainer?.service,
    remoteContainerInState?.service,
    signedOut,
  ]);

  return {value: remoteTokenData?.accessToken, loading, remoteContainer};
}
