import { useSelector, useDispatch } from "react-redux";
import { useEffect, useRef } from "react";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import {
  ListAlt as List,
  Map,
  AutoAwesome as Chat,
  Settings,
} from "@mui/icons-material";
import {
  setViewModeInMobile,
  setOpenChat,
  setBottomBarHeight,
} from "../layoutSlice";
import { setOpenAppConfig } from "Features/appConfig/appConfigSlice";

export default function BottomBarMobile() {
  const dispatch = useDispatch();
  const ref = useRef();

  const customColor = "#ff6b00"; // <<< ta couleur custom
  const settingsS = "Config.";
  const mapLabel = "Plan";
  const listLabel = "Liste";
  const chatLabel = "IA";

  useEffect(() => {
    const height = ref.current?.offsetHeight ?? 0;
    dispatch(setBottomBarHeight(height));
  }, [dispatch]);

  // data
  let viewModeInMobile = useSelector((state) => state.layout.viewModeInMobile);
  const openChat = useSelector((state) => state.layout.openChat);
  if (openChat) viewModeInMobile = "CHAT"; // <<< bugfix: c'était '==='

  function handleChange(_e, newValue) {
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
    <Paper
      ref={ref}
      sx={{
        pb: 2,
        bgcolor: "white",
        zIndex: 1000,
        borderTop: "1px solid grey",
      }}
    >
      <BottomNavigation
        value={viewModeInMobile}
        onChange={handleChange}
        showLabels
        sx={{
          // couleur par défaut (non sélectionné)
          "& .MuiBottomNavigationAction-root": {
            color: "text.secondary",
          },
          // couleur quand sélectionné (label + icône héritent de currentColor)
          "& .MuiBottomNavigationAction-root.Mui-selected": {
            color: customColor,
          },
          // (optionnel) barre d’indicateur si tu en as un style perso
          // "& .Mui-selected .MuiSvgIcon-root": { color: customColor }, // pas nécessaire généralement
        }}
      >
        {/* <BottomNavigationAction
          label={settingsS}
          value="SETTINGS"
          icon={<Settings fontSize="large" />}
        /> */}
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
        {/* <BottomNavigationAction
          label={chatLabel}
          value="CHAT"
          icon={<Chat fontSize="large" />}
        /> */}
      </BottomNavigation>
    </Paper>
  );
}
