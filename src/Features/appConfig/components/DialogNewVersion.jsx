import { useDispatch, useSelector } from "react-redux";

import {
  Alert,
  AlertTitle,
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

  // helpers

  // Optional "important message" published in version.json: shown in a
  // warning banner above the changelog, hidden when absent or blank.
  const hasWarning = Boolean(newVersion?.mainWarningMessage?.trim());

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
        {hasWarning && (
          <Alert severity="warning" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>
            <AlertTitle>Important</AlertTitle>
            {newVersion.mainWarningMessage}
          </Alert>
        )}
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
