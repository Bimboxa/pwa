import { useSelector, useDispatch } from "react-redux";

import { setOpenAppConfig } from "Features/appConfig/appConfigSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";

import PanelConfiguration from "./PanelConfiguration";

// Full-page configuration dialog — single global mount (MainApp). Every entry
// point (left-band "Configuration" button, org-name buttons, mobile "Config."
// nav, selector-page gear) opens it through the shared openAppConfig flag.
export default function DialogConfiguration() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.appConfig.openAppConfig);

  // handlers

  function handleClose() {
    dispatch(setOpenAppConfig(false));
  }

  // render

  return (
    <DialogGeneric
      open={open}
      onClose={handleClose}
      title="Configuration"
      vh={90}
      vw={92}
    >
      <PanelConfiguration onClose={handleClose} />
    </DialogGeneric>
  );
}
