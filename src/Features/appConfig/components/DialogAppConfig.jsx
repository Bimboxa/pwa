import {useSelector, useDispatch} from "react-redux";

import {setOpenAppConfig} from "../appConfigSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelAppConfig from "./PanelAppConfig";

export default function DialogAppConfig() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.appConfig.openAppConfig);

  // handlers

  function handleClose() {
    dispatch(setOpenAppConfig(false));
  }

  return (
    <DialogGeneric
      open={open}
      onClose={handleClose}
      title="Configuration de l'application"
    >
      <PanelAppConfig />
    </DialogGeneric>
  );
}
