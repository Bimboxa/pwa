import {useEffect, useState} from "react";
import {useSelector} from "react-redux";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

import {getTokenClientAsync, signIn} from "../gapiServicesAuth";
import {get} from "firebase/database";

export default function DialogConnectToGapi({open, onClose}) {
  //
  // strings

  const title = "Connexion à Google Drive";
  const saveS = "Se connecter";

  const description =
    "Vous pouvez vous connecter à une bimbox stockée sur Google Drive";

  // data

  const isSignedIn = useSelector((s) => s.gapi.isSignedIn);

  // state

  const [tokenClient, setTokenClient] = useState(null);

  // helpers

  const isSignedInS = isSignedIn ? "Connecté" : "Déconnecté";

  // effect

  useEffect(() => {
    async function initAsync() {
      const tokenClient = await getTokenClientAsync();
      setTokenClient(tokenClient);
    }
    initAsync();
  }, []);
  // handlers

  async function handleConnectClick() {
    console.log("tokenClient", tokenClient);
    signIn(tokenClient);
    //const files = await listFiles();
    //console.log("files", files);
  }
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{isSignedInS}</Typography>
        <Typography>{description}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleConnectClick}>{saveS}</Button>
      </DialogActions>
    </Dialog>
  );
}
