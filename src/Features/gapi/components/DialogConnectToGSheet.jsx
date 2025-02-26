import {useState} from "react";
import {useDispatch, useSelector} from "react-redux";

import {setGSheetId} from "../gapiSlice";

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

import {batchUpdateGSheet} from "../gapiServicesGSheet";
import changeFirstRowColor from "../requests/changeFirstRowColor";

//import {listFiles} from "../gapiServicesFiles";

export default function DialogConnectToGSheet({open, onClose}) {
  const dispatch = useDispatch();

  // strings

  const title = "Connecter la liste à une Google Sheet";

  const description = "Saisissez l'url de la Google Sheet";

  const saveS = "Connecter";

  const label = "Id du dossier";

  const testS = "Tester la connexion";

  // state

  const [sheetId, setFolderId] = useState("");

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
    const id = sheetId.trim();
    //const files = await listFiles(id);
  }

  function handleSave() {
    dispatch(setGSheetId(sheetId));
    onClose();
  }

  function handleClose() {
    onClose();
  }

  function handleTestClick() {
    batchUpdateGSheet({sheetId, requests: changeFirstRowColor()});
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
            value={sheetId}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <Button onClick={handleTestClick} size="small">
            {testS}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSave}>{saveS}</Button>
      </DialogActions>
    </Dialog>
  );
}
