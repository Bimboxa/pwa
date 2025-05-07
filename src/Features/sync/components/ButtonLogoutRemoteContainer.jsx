import {useDispatch} from "react-redux";

import {setRemoteContainer} from "../syncSlice";

import setSignedOutInLocalStorage from "../services/setSignedOutInLocalStorage";
import setRemoteContainerInLocalStorage from "../services/setRemoteContainerInLocalStorage";

import {useRemoteTokenData} from "../RemoteTokenDataContext";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function ButtonLogoutRemoteContainer({remoteContainer}) {
  const dispatch = useDispatch();
  // data

  const {setRemoteTokenData} = useRemoteTokenData();

  //strings

  const label = "Se déconnecter";

  // handlers

  function handleClick() {
    try {
      console.log("[SectionRemoteContainer] handleDisconnexion");
      setRemoteTokenData(null);
      setSignedOutInLocalStorage(true);
    } catch (e) {
      console.error("[SectionRemoteContainer] error handleDisconnexion", e);
    }
  }
  return <ButtonInPanel onClick={handleClick} label={label} />;
}
