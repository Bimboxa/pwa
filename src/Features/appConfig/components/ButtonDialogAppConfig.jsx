import {useDispatch, useSelector} from "react-redux";

import {setOpenAppConfig} from "../appConfigSlice";

import useAppConfig from "../hooks/useAppConfig";

import {Button, Typography} from "@mui/material";

import DialogAppConfig from "./DialogAppConfig";

export default function ButtonDialogAppConfig() {
  const dispatch = useDispatch();
  // data

  const appConfig = useAppConfig();

  // state

  const open = useSelector((s) => s.appConfig.openAppConfig);

  // helpers

  const label = `${appConfig?.name ?? "-?-"}`;

  // handlers

  return (
    <>
      <Button onClick={() => dispatch(setOpenAppConfig(true))}>
        <Typography variant="body2">{label}</Typography>
      </Button>
      <DialogAppConfig />
    </>
  );
}
