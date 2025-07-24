import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, IconButton, Tooltip } from "@mui/material";

import reloadApp from "Features/appConfig/services/reloadApp";

export default function LogoApp() {
  // data

  const version = useSelector((s) => s.appConfig.appVersion);
  const appConfig = useAppConfig();

  // helper

  const title = `${appConfig?.appName} v.${version}`;

  // handlers

  function handleClick() {
    reloadApp();
  }
  return (
    <Tooltip title={title}>
      <Box sx={{ bgcolor: "white", borderRadius: "8px" }}>
        <IconButton onClick={handleClick}>
          <Box
            sx={{
              borderRadius: "8px",
              width: 24,
              height: 24,
              backgroundImage: "url(/logo512.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          />
        </IconButton>
      </Box>
    </Tooltip>
  );
}
