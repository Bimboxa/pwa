import {useState} from "react";
import useAppConfig from "../hooks/useAppConfig";

import {Button, Typography} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelAppConfig from "./PanelAppConfig";

export default function ButtonDialogAppConfig() {
  // data

  const appConfig = useAppConfig();

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const label = `${appConfig?.name ?? "-?-"}`;

  // handlers

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Typography variant="body2">{label}</Typography>
      </Button>
      <DialogGeneric open={open} onClose={() => setOpen(false)}>
        <PanelAppConfig />
      </DialogGeneric>
    </>
  );
}
