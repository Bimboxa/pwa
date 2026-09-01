import { useDispatch } from "react-redux";

import { setOpenAppConfig } from "../appConfigSlice";

import useAppConfig from "../hooks/useAppConfig";

import { Button, Typography } from "@mui/material";

// Org-name button (bottom bar, dashboard footer) opening the full-page
// Configuration dialog (DialogConfiguration, mounted globally in MainApp).
export default function ButtonDialogAppConfig() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // helpers

  // Avoid rendering "undefined." while the org yaml is still loading.
  const label = appConfig?.name ? `${appConfig.name}.` : "...";

  // render

  return (
    <Button onClick={() => dispatch(setOpenAppConfig(true))}>
      <Typography variant="body2">{label}</Typography>
    </Button>
  );
}
