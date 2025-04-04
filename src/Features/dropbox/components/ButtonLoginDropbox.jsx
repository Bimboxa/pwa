import {useState} from "react";

//import {useAccessToken} from "../AccessTokenDropboxContext";
import {useRemoteTokenData} from "Features/sync/RemoteTokenDataContext";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import exchangeCodeForToken from "../services/exchangeCodeForToken";
import openDropboxAuthPopup from "../services/openDropboxAuthPopup";
import useToken from "Features/auth/hooks/useToken";

export default function ButtonLoginDropbox({clientId}) {
  const token = useToken();

  // state

  const [loading, setLoading] = useState(false);

  // data

  const {setRemoteTokenData} = useRemoteTokenData();

  // string

  const loginS = "Se connecter";

  // handlers

  async function handleClick() {
    const code = await openDropboxAuthPopup();
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
