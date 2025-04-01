import {useAccessToken} from "../AccessTokenDropboxContext";

import {Button} from "@mui/material";

export default function ButtonLogoutDropbox() {
  // label

  const label = "Se déconnecter de Dropbox";

  // data

  const {accessToken, setAccessToken} = useAccessToken();

  // handlers

  function handleClick() {
    setAccessToken(null);
  }

  return <Button onClick={handleClick}>{label}</Button>;
}
