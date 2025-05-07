import {useState} from "react";

import {useDispatch} from "react-redux";

import {setWarningWasShowed} from "Features/init/initSlice";

import useRemoteContainer from "../hooks/useRemoteContainer";
import useRemoteToken from "../hooks/useRemoteToken";

import {Box, Typography} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import getHideWarningFromLocalStorage from "../services/getHideWarningFromLocalStorage";
import setHideWarningInLocalStorage from "../services/setHideWarningInLocalStorage";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import ButtonLoginRemoteContainer from "./ButtonLoginRemoteContainer";

export default function DialogAutoRemoteContainerConnexion() {
  const dispatch = useDispatch();

  // strings

  const title = "Sauvegarde des données";
  const connectLaterS = "Se connecter plus tard";

  // state

  const [updatedAt, setUpdatedAt] = useState();

  // const

  const hideWarning = getHideWarningFromLocalStorage();

  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // helpers

  const openDialog = !hideWarning && !accessToken && remoteContainer;

  // helper - message

  const messageS = `En cas de problèmes, essayez d'abord de vous connecter à ${remoteContainer.service} depuis le site web de ${remoteContainer.service}`;

  // handler

  function handleToggleWarning() {
    setHideWarningInLocalStorage(!showWarning);
  }

  function handleConnectLater() {
    dispatch(setWarningWasShowed(true));
    setHideWarningInLocalStorage(true);
    setUpdatedAt(Date.now());
  }

  function handleClose() {}

  return (
    <DialogGeneric open={openDialog} onClose={handleClose} title={title}>
      <Box sx={{p: 2}}>
        <Typography variant="body2" color="text.secondary">
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
