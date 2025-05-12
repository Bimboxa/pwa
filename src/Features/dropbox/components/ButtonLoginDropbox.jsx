import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import startDropboxAuth from "../services/startDropboxAuth";

export default function ButtonLoginDropbox({clientId}) {
  // string

  const loginS = "Se connecter";

  // handlers

  function handleClick() {
    startDropboxAuth(clientId);
  }

  return (
    <ButtonInPanel
      label={loginS}
      onClick={handleClick}
      bgcolor="secondary.main"
    />
  );
}
