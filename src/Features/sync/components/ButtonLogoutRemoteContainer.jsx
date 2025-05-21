import {useDispatch, useSelector} from "react-redux";

import {setRemoteContainer} from "../syncSlice";

import setSignedOutInLocalStorage from "../services/setSignedOutInLocalStorage";
import setRemoteContainerInLocalStorage from "../services/setRemoteContainerInLocalStorage";

import {useRemoteTokenData} from "../RemoteTokenDataContext";

import {Box, Typography} from "@mui/material";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function ButtonLogoutRemoteContainer({remoteContainer}) {
  const dispatch = useDispatch();
  // data

  const {setRemoteTokenData} = useRemoteTokenData();
  const rcUserAccount = useSelector((s) => s.sync.rcUserAccount);

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
  return (
    <Box sx={{width: 1}}>
      <ButtonInPanel onClick={handleClick} label={label} />
      <Typography variant="caption" color="text.secondary">
        {rcUserAccount?.email}
      </Typography>
    </Box>
  );
}
