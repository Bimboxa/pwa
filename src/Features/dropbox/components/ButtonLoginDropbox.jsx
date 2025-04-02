import {useDispatch} from "react-redux";

//import {useAccessToken} from "../AccessTokenDropboxContext";
import {useRemoteTokenData} from "Features/sync/RemoteTokenDataContext";

import ButtonBasicMobile from "Features/layout/components/ButtonBasicMobile";

import exchangeCodeForToken from "../services/exchangeCodeForToken";
import openDropboxAuthPopup from "../services/openDropboxAuthPopup";
import useToken from "Features/auth/hooks/useToken";

export default function ButtonLoginDropbox() {
  const dispatch = useDispatch();
  const token = useToken();

  // data

  const {setRemoteTokenData} = useRemoteTokenData();

  // string

  const loginS = "Se connecter";

  // handlers

  async function handleClick() {
    const code = await openDropboxAuthPopup();
    const accessTokenData = await exchangeCodeForToken({code, token});
    //
    const expiresAt = Date.now() + accessTokenData?.expiresIn * 1000;
    setRemoteTokenData({...accessTokenData, expiresAt});
  }

  return <ButtonBasicMobile label={loginS} onClick={handleClick} />;
}
