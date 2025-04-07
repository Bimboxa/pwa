import {useState} from "react";

//import {useAccessToken} from "../AccessTokenDropboxContext";
import {useRemoteTokenData} from "Features/sync/RemoteTokenDataContext";
import useIsMobile from "Features/layout/hooks/useIsMobile";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import exchangeCodeForToken from "../services/exchangeCodeForToken";
import startDropboxAuth from "../services/startDropboxAuth";
import useToken from "Features/auth/hooks/useToken";

export default function ButtonLoginDropbox({clientId}) {
  const token = useToken();
  console.log("[ButtonLoginDropbox] clientId", clientId);

  // state

  const [loading, setLoading] = useState(false);

  // data

  const {setRemoteTokenData} = useRemoteTokenData();
  const isMobile = useIsMobile();

  // string

  const loginS = "Se connecter";

  // handlers

  async function handleClick() {
    console.log("[ButtonLoginDropbox] handleClick", clientId);
    const code = await startDropboxAuth(clientId, {withPopup: !isMobile});

    // mobile
    if (isMobile) return;

    // not mobile ...
    try {
      setLoading(true);
      const accessTokenData = await exchangeCodeForToken({
        code,
        token,
        clientId,
      });
      //
      const expiresAt = Date.now() + accessTokenData?.expiresIn * 1000;
      setRemoteTokenData({...accessTokenData, expiresAt});
    } catch (e) {
      console.error("[ButtonLoginDropbox] Error exchanging code for token", e);
      setLoading(false);
    }
  }

  return <ButtonInPanel label={loginS} onClick={handleClick} />;
}
