import { useDispatch } from "react-redux";

import { setOpenStartingDialog } from "../startingSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Button } from "@mui/material";
import RocketLaunch from "@mui/icons-material/RocketLaunch";

import getStartingVocabulary from "../utils/getStartingVocabulary";

// « Démarrer avec <appName> » text button at the top-left of the dashboard:
// opens the full-page starting dialog (DialogStarting, mounted in MainApp).
export default function ButtonOpenStarting() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // strings

  const { startLabelS } = getStartingVocabulary(appConfig);

  // handlers

  function handleClick() {
    dispatch(setOpenStartingDialog(true));
  }

  // render

  return (
    <Button
      variant="text"
      color="secondary"
      startIcon={<RocketLaunch />}
      onClick={handleClick}
      sx={{
        flexShrink: 0,
        whiteSpace: "nowrap",
        borderRadius: 999,
        height: 48,
        px: 2,
        fontWeight: 600,
      }}
    >
      {startLabelS}
    </Button>
  );
}
