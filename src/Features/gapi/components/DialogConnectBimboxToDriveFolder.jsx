import {useState} from "react";
import {useDispatch, useSelector} from "react-redux";

import {setBimboxFolderId} from "../gapiSlice";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  TextField,
} from "@mui/material";

//import {listFiles} from "../gapiServicesFiles";

export default function DialogConnectBimboxToDriveFolder({open, onClose}) {
  const dispatch = useDispatch();

  // strings

  const title = "Connecter la bimbox à un dossier Google Drive";

  const description =
    "Saisissez l'id du dossier, visible dans l'url de Google Drive";

  const saveS = "Connecter";

  const label = "Id du dossier";

  // state

  const [folderId, setFolderId] = useState("");

  // data

  const gapiIsLoaded = useSelector((s) => s.gapi.gapiIsLoaded);

  // helper

  const connectedS = gapiIsLoaded
    ? "Google Drive disponible"
    : "Google Drive non disponible";

  // handlers

  function handleChange(event) {
    setFolderId(event.target.value);
  }

  async function handleBlur() {
    const id = folderId.trim();
    //const files = await listFiles(id);
    console.log("files", files);
  }

  function handleSave() {
    dispatch(setBimboxFolderId(folderId));
    onClose();
  }

  function handleClose() {
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{p: 1}}>
          <Typography variant="body2">{connectedS}</Typography>
          <Typography sx={{mb: 2}}>{description}</Typography>
          <TextField
            label={label}
            fullWidth
            value={folderId}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSave}>{saveS}</Button>
      </DialogActions>
    </Dialog>
  );
}
