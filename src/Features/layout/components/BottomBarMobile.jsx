import {useSelector, useDispatch} from "react-redux";

import {setViewModeInMobile, setOpenChat} from "../layoutSlice";

import {BottomNavigation, BottomNavigationAction, Paper} from "@mui/material";
import {
  ListAlt as List,
  Map,
  SmartToy as Chat,
  Settings,
} from "@mui/icons-material";
import {setOpenAppConfig} from "Features/appConfig/appConfigSlice";

export default function BottomBarMobile() {
  const dispatch = useDispatch();

  // strings

  const settingsS = "Config.";
  const mapLabel = "Plan";
  const listLabel = "Liste";
  const chatLabel = "IA";

  // data

  let viewModeInMobile = useSelector((state) => state.layout.viewModeInMobile);
  const openChat = useSelector((state) => state.layout.openChat);
  if (openChat) viewModeInMobile === "CHAT";

  // handlers

  function handleChange(event, newValue) {
    if (newValue === "CHAT") {
      dispatch(setOpenChat(true));
    } else if (newValue === "SETTINGS") {
      dispatch(setOpenAppConfig(true));
    } else {
      dispatch(setOpenChat(false));
      dispatch(setViewModeInMobile(newValue));
    }
  }

  return (
    <Paper sx={{pb: 2}}>
      <BottomNavigation
        value={viewModeInMobile}
        onChange={handleChange}
        showLabels
      >
        <BottomNavigationAction
          label={settingsS}
          value="SETTINGS"
          icon={<Settings />}
        />
        <BottomNavigationAction
          label={listLabel}
          value="LIST"
          icon={<List />}
        />
        <BottomNavigationAction label={mapLabel} value="MAP" icon={<Map />} />
        <BottomNavigationAction
          label={chatLabel}
          value="CHAT"
          icon={<Chat />}
        />
      </BottomNavigation>
    </Paper>
  );
}
