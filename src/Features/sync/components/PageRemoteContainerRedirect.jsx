import {useEffect} from "react";
import {useNavigate} from "react-router-dom";

import {useDispatch} from "react-redux";

import {setRemoteContainer, setSignedOut} from "../syncSlice";

import useToken from "Features/auth/hooks/useToken";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useIsMobile from "Features/layout/hooks/useIsMobile";
import {useRemoteTokenData} from "Features/sync/RemoteTokenDataContext";

import PageGeneric from "Features/layout/components/PageGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";
import CircularProgress from "@mui/material/CircularProgress";

import exchangeCodeForToken from "Features/dropbox/services/exchangeCodeForToken";
import setRemoteContainerInLocalStorage from "../services/setRemoteContainerInLocalStorage";
import setSignedOutInLocalStorage from "../services/setSignedOutInLocalStorage";

export default function PageRemoteContainerRedirect() {
  const navigate = useNavigate();
  const token = useToken();
  const dispatch = useDispatch();

  // session

  const remoteContainerS = sessionStorage.getItem("remote_container");
  const remoteContainer = remoteContainerS
    ? JSON.parse(remoteContainerS)
    : null;

  console.log("remoteContainer", remoteContainer);
  // init

  useEffect(() => {}, []);
  // data

  const queryParams = new URLSearchParams(window.location.search);
  const code = queryParams.get("code");
  const isMobile = useIsMobile();
  const appConfig = useAppConfig();
  const remoteContainers = appConfig?.remoteContainers ?? [];

  const {setRemoteTokenData} = useRemoteTokenData();

  // helpers

  async function getDropboxToken() {
    try {
      const accessTokenData = await exchangeCodeForToken({
        code,
        token,
        clientId: remoteContainer.clientId,
      });
      //
      const expiresAt = Date.now() + accessTokenData?.expiresIn * 1000;
      setRemoteTokenData({...accessTokenData, expiresAt});

      // remoteContainer
      const rc = remoteContainers.find(
        (r) => r.service === remoteContainer.service
      );
      dispatch(setRemoteContainer(rc));
      dispatch(setSignedOut(false));
      setSignedOutInLocalStorage("false");
      setRemoteContainerInLocalStorage(rc);
      navigate("/");
    } catch (e) {
      console.log("error", e);
      navigate("/");
    }
  }
  // effects

  useEffect(() => {
    if (code && token) {
      if (remoteContainer?.service === "DROPBOX") {
        getDropboxToken();
      }
    }

    // Close popup after short delay
    //setTimeout(() => window.close(), 500);
  }, [code, remoteContainer?.service, token]);

  return (
    <PageGeneric>
      <BoxCenter>{<CircularProgress />}</BoxCenter>
    </PageGeneric>
  );
}
