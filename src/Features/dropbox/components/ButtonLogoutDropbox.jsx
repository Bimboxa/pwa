import {useRemoteTokenData} from "Features/sync/RemoteTokenDataContext";

import {Button} from "@mui/material";

export default function ButtonLogoutDropbox() {
  // label

  const label = "Se déconnecter de Dropbox";

  // data

  const {remoteTokenData, setRemoteTokenData} = useRemoteTokenData();

  // handlers

  function handleClick() {
    setRemoteTokenData(null);
  }

  return <Button onClick={handleClick}>{label}</Button>;
}
