import {useState} from "react";

import {Typography} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import useRemoteContainer from "../hooks/useRemoteContainer";
import RemoteProvider from "../js/RemoteProvider";
import useRemoteToken from "../hooks/useRemoteToken";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function ButtonInPanelGetUserAccount() {
  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // strings

  const accountS = `Utilisateur ${remoteContainer.service}`;

  // state

  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState([]);
  const [loading, setLoading] = useState(false);

  // handlers

  async function handleClick() {
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    setLoading(true);
    let account = await remoteProvider.getUserAccount();
    console.log("account", account);
    setLoading(false);
    setAccount(account);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setItems([]);
  }

  return (
    <>
      <DialogGeneric open={open} onClose={handleClose} title={accountS}>
        <BoxFlexVStretch sx={{overflow: "auto"}}>
          <Box sx={{p: 1}}>
            <Typography>{account.email}</Typography>
          </Box>
        </BoxFlexVStretch>
      </DialogGeneric>
      <ButtonInPanel
        label={accountS}
        loading={loading}
        onClick={handleClick}
        bgcolor="white"
        color="text.primary"
      />
    </>
  );
}
