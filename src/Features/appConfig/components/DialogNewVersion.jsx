import { useDispatch, useSelector } from "react-redux";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import { setNewVersionDialogOpen } from "../appConfigSlice";
import reloadApp from "../services/reloadApp";

const LAST_SEEN_VERSION_KEY = "appLastSeenVersion";

export default function DialogNewVersion() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.appConfig.newVersionDialogOpen);
  const newVersion = useSelector((s) => s.appConfig.newVersionAvailable);

  // handlers

  function handleLater() {
    if (newVersion?.version) {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, newVersion.version);
    }
    dispatch(setNewVersionDialogOpen(false));
  }

  function handleUpdateNow() {
    reloadApp();
  }

  // render

  if (!newVersion) return null;

  return (
    <Dialog open={open} onClose={handleLater} maxWidth="sm" fullWidth>
      <DialogTitle>
        {`Nouvelle version disponible (v.${newVersion.version})`}
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ whiteSpace: "pre-wrap" }}>
          {newVersion.description}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleLater}>Plus tard</Button>
        <Button onClick={handleUpdateNow} variant="contained" color="primary">
          Mettre à jour maintenant
        </Button>
      </DialogActions>
    </Dialog>
  );
}
