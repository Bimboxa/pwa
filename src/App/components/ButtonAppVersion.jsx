import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Tooltip } from "@mui/material";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import reloadApp from "Features/appConfig/services/reloadApp";

export default function ButtonAppVersion() {
  // strings

  const title = "Mettre à jour";

  // data

  const version = useSelector((s) => s.appConfig.appVersion);
  const appConfig = useAppConfig();

  // helper

  const label = `${appConfig?.appName} v.${version}`;

  // handlers

  function handleClick() {
    reloadApp();
  }
  return (
    <Tooltip title={title}>
      <ButtonGeneric label={label} onClick={handleClick} />
    </Tooltip>
  );
}
