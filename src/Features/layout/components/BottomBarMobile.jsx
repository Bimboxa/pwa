import {useSelector, useDispatch} from "react-redux";
import {useEffect, useRef} from "react";

import {
  setViewModeInMobile,
  setOpenChat,
  setBottomBarHeight,
} from "../layoutSlice";

import {BottomNavigation, BottomNavigationAction, Paper} from "@mui/material";
import {
  ListAlt as List,
  Map,
  AutoAwesome as Chat,
  Settings,
} from "@mui/icons-material";
import {setOpenAppConfig} from "Features/appConfig/appConfigSlice";

export default function BottomBarMobile() {
  const dispatch = useDispatch();
  const ref = useRef();

  // strings

  const settingsS = "Config.";
  const mapLabel = "Plan";
  const listLabel = "Liste";
  const chatLabel = "IA";

  // effect

  useEffect(() => {
    const height = ref.current.offsetHeight;
    dispatch(setBottomBarHeight(height));
  }, []);

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
    <Paper ref={ref} sx={{pb: 2}}>
      <BottomNavigation
        value={viewModeInMobile}
        onChange={handleChange}
        showLabels
      >
        <BottomNavigationAction
          label={settingsS}
          value="SETTINGS"
          icon={<Settings fontSize="large" />}
        />
        <BottomNavigationAction
          label={listLabel}
          value="LIST"
          icon={<List fontSize="large" />}
        />
        <BottomNavigationAction
          label={mapLabel}
          value="MAP"
          icon={<Map fontSize="large" />}
        />
        <BottomNavigationAction
          label={chatLabel}
          value="CHAT"
          icon={<Chat fontSize="large" />}
        />
      </BottomNavigation>
    </Paper>
  );
}
