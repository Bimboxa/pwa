import { useDispatch, useSelector } from "react-redux";

import { setConfirmSaveDialogOpen } from "../remoteScopeConfigurationsSlice";

import { Box, DialogTitle, Typography } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import useSaveScopeVersion from "../hooks/useSaveScopeVersion";

export default function DialogConfirmSaveVersion() {
  const dispatch = useDispatch();

  // data

  const open = useSelector(
    (s) => s.remoteScopeConfigurations.confirmSaveDialogOpen
  );

  const saveScopeVersion = useSaveScopeVersion();

  // handlers

  function handleClose() {
    dispatch(setConfirmSaveDialogOpen(false));
  }

  function handleConfirm() {
    dispatch(setConfirmSaveDialogOpen(false));
    saveScopeVersion();
  }

  return (
    <DialogGeneric open={open} onClose={handleClose} width={500}>
      <DialogTitle>Sauvegarder une nouvelle version ?</DialogTitle>

      <Typography
        variant="body2"
        sx={{ px: 3, pb: 2, color: "text.secondary" }}
      >
        La configuration du projet sera sauvegardée et envoyée sur le serveur.
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
          label="Annuler"
        />
        <ButtonGeneric
          variant="contained"
          color="primary"
          onClick={handleConfirm}
          label="Sauvegarder"
        />
      </Box>
    </DialogGeneric>
  );
}
