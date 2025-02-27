import {useState} from "react";
import {useDispatch, useSelector} from "react-redux";

import {setBimboxFolderId, setGSheetId} from "../gapiSlice";

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
import {getQtyTakeoffFileService} from "../gapiServicesFiles";

//import {listFiles} from "../gapiServicesFiles";

export default function DialogConnectBimboxToDriveFolder({open, onClose}) {
  const dispatch = useDispatch();

  // strings

  const title = "Connecter la bimbox à un dossier Google Drive";

  const description =
    "Saisissez l'id du dossier, visible dans l'url de Google Drive";

  const saveS = "Connecter";

  const testS = "Test";

  const label = "Id du dossier";

  // state

  const [folderId, setFolderId] = useState("");
  const [qtyTakeoffFile, setQtyTakeoffFile] = useState(null);

  // data

  const gapiIsLoaded = useSelector((s) => s.gapi.gapiIsLoaded);

  // helper

  const connectedS = gapiIsLoaded
    ? "Google Drive disponible"
    : "Google Drive non disponible";

  const testLabel = `GSheet "Métré" connectée`;

  // handlers

  function handleChange(event) {
    setFolderId(event.target.value);
  }

  function handleSave() {
    dispatch(setBimboxFolderId(folderId));
    onClose();
  }

  function handleClose() {
    onClose();
  }

  async function handleTestClick() {
    const file = await getQtyTakeoffFileService(folderId);
    setQtyTakeoffFile(file);
    dispatch(setGSheetId(file.id));
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
          />
          <Box sx={{display: "flex", alignItems: "center"}}>
            <Button onClick={handleTestClick}>{testS}</Button>
            {qtyTakeoffFile && (
              <Typography variant="body2" color="text.secondary">
                {testLabel}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleSave}>
          {saveS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
