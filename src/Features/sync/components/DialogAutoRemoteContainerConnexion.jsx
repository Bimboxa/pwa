import {useState, useEffect} from "react";

import {useDispatch, useSelector} from "react-redux";

import {setWarningWasShowed} from "Features/init/initSlice";

import useRemoteContainer from "../hooks/useRemoteContainer";
import useRemoteToken from "../hooks/useRemoteToken";

import {Box, Typography} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import getHideWarningFromLocalStorage from "../services/getHideWarningFromLocalStorage";
import setHideWarningInLocalStorage from "../services/setHideWarningInLocalStorage";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import ButtonLoginRemoteContainer from "./ButtonLoginRemoteContainer";
import {Warning} from "@mui/icons-material";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function DialogAutoRemoteContainerConnexion() {
  const dispatch = useDispatch();

  // strings

  const title = "Sauvegarde des données";
  const connectLaterS = "Se connecter plus tard";

  // state

  const [updatedAt, setUpdatedAt] = useState();

  // const

  const hideWarning = getHideWarningFromLocalStorage();
  //const hideWarning = useSelector((s) => s.init.warningWasShowed);
  console.log("hideWarning", hideWarning);

  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // helpers

  const openDialog = !hideWarning && !accessToken && remoteContainer;

  // effect - setWarning was shown if auto connect

  useEffect(() => {
    if (accessToken) {
      dispatch(setWarningWasShowed(true));
      setHideWarningInLocalStorage(true);
      setUpdatedAt(Date.now());
    }
  }, [accessToken]);

  // helper - message

  const message1 = `L'application doit se connecter à ${remoteContainer?.service} pour récupérer les données de votre organisation.`;
  const message2 = `En cas de problèmes, essayez d'abord de vous connecter à ${remoteContainer?.service} depuis le site web de ${remoteContainer?.service}`;

  const messageS = `${message1} 
  
  ${message2}`;

  // handler

  function handleConnectLater() {
    dispatch(setWarningWasShowed(true));
    setHideWarningInLocalStorage(true);
    setUpdatedAt(Date.now());
  }

  function handleClose() {}

  return (
    <DialogGeneric open={openDialog} onClose={handleClose} title={title}>
      <BoxCenter sx={{width: 1, height: 40}}>
        <Warning sx={{color: "warning.main"}} />
      </BoxCenter>

      <Box sx={{p: 2}}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{whiteSpace: "pre-line"}}
        >
          {messageS}
        </Typography>
      </Box>
      <ButtonLoginRemoteContainer remoteContainer={remoteContainer} />
      <ButtonInPanel
        label={connectLaterS}
        onClick={handleConnectLater}
        bgcolor="grey.600"
      />
    </DialogGeneric>
  );
}
