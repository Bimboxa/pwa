import {useSelector, useDispatch} from "react-redux";

import {setOpenAppConfig} from "../appConfigSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelAppConfig from "./PanelAppConfig";

export default function DialogAppConfig() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.appConfig.openAppConfig);
  const version = useSelector((s) => s.appConfig.appVersion);

  // helpers

  const title = `v.${version}`;

  // handlers

  function handleClose() {
    dispatch(setOpenAppConfig(false));
  }

  return (
    <DialogGeneric open={open} onClose={handleClose} title={title}>
      <PanelAppConfig />
    </DialogGeneric>
  );
}
