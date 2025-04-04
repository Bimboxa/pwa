import {useState} from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {Box, Typography, IconButton} from "@mui/material";
import {Settings} from "@mui/icons-material";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import Panel from "Features/layout/components/Panel";
import PanelAppConfig from "./PanelAppConfig";

export default function BarAppConfig() {
  // state

  const [open, setOpen] = useState(false);
  // data

  const appConfig = useAppConfig();

  // helpers

  const name = appConfig?.name ?? "...";

  // handlers

  function handleClick() {
    setOpen(true);
  }
  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <Box
        sx={{
          width: 1,
          display: "flex",
          justifyContent: "space-between",
          p: 1,
          alignItems: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {name}
        </Typography>
        <IconButton onClick={handleClick} size="small">
          <Settings fontSize="small" />
        </IconButton>
      </Box>
      <DialogGeneric
        open={open}
        onClose={handleClose}
        title="Configuration de l'application"
      >
        <PanelAppConfig />
      </DialogGeneric>
    </>
  );
}
