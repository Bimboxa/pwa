import {useDispatch} from "react-redux";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function ButtonLogoutRemoteContainer({onDisconnexion}) {
  const dispatch = useDispatch();

  //strings

  const label = "Se déconnecter";

  // handlers

  function handleClick() {
    onDisconnexion();
  }
  return <ButtonInPanel onClick={handleClick} label={label} />;
}
