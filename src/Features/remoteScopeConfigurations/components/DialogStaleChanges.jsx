import { useDispatch, useSelector } from "react-redux";

import { setStaleChangesDialogOpen } from "../remoteScopeConfigurationsSlice";

import { notifyDialogDismissed } from "../services/localChangeTracker";

import { Box, DialogTitle, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function DialogStaleChanges({ onConfirmSave }) {
  const dispatch = useDispatch();

  // data

  const open = useSelector(
    (s) => s.remoteScopeConfigurations.staleChangesDialogOpen
  );

  // handlers

  function handleClose() {
    dispatch(setStaleChangesDialogOpen(false));
    notifyDialogDismissed();
  }

  function handleSaveNow() {
    dispatch(setStaleChangesDialogOpen(false));
    notifyDialogDismissed();
    if (onConfirmSave) onConfirmSave();
  }

  return (
    <DialogGeneric open={open} onClose={handleClose} width={500}>
      <DialogTitle>Sauvegarde recommandée</DialogTitle>

      <Typography
        variant="body2"
        sx={{ px: 3, pb: 2, color: "text.secondary" }}
      >
        Votre dernière modification date d&apos;il y a plus de 30 minutes.
        Voulez-vous sauvegarder une nouvelle version sur le serveur ?
      </Typography>

      <Box
        sx={{
          px: 3,
          pb: 3,
          display: "flex",
          gap: 1,
          justifyContent: "flex-end",
        }}
      >
        <ButtonGeneric
          variant="outlined"
          onClick={handleClose}
          label="Plus tard"
        />
        <ButtonGeneric
          variant="contained"
          color="primary"
          startIcon={<CloudUploadIcon />}
          onClick={handleSaveNow}
          label="Sauvegarder maintenant"
        />
      </Box>
    </DialogGeneric>
  );
}
