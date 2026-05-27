import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Badge, Tooltip } from "@mui/material";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import reloadApp from "Features/appConfig/services/reloadApp";

export default function ButtonAppVersion() {
  // data

  const appConfig = useAppConfig();
  const newVersionAvailable = useSelector(
    (s) => s.appConfig.newVersionAvailable
  );

  // helper

  // Avoid rendering "undefined v.undefined" during the brief window before
  // the org yaml is loaded into state.appConfig.value.
  const label = appConfig
    ? `${appConfig.appName} v.${appConfig.appVersion}`
    : "...";
  const title = newVersionAvailable?.version
    ? `Nouvelle version disponible (v.${newVersionAvailable.version}) — cliquer pour mettre à jour`
    : "Mettre à jour";

  // handlers

  function handleClick() {
    reloadApp();
  }

  // render

  return (
    <Tooltip title={title}>
      <Badge
        color="warning"
        variant="dot"
        invisible={!newVersionAvailable}
        overlap="rectangular"
      >
        <ButtonGeneric label={label} onClick={handleClick} />
      </Badge>
    </Tooltip>
  );
}
