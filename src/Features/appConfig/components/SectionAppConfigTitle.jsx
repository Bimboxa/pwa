import {useState} from "react";

import {useDispatch} from "react-redux";

import {setToaster} from "Features/layout/layoutSlice";

import useAppConfig from "../hooks/useAppConfig";
import useRefreshAppConfig from "../hooks/useRefreshAppConfig";

import {Box, IconButton, Typography,Tooltip} from "@mui/material";
import {Refresh} from "@mui/icons-material";

export default function SectionAppConfigTitle() {
  const dispatch = useDispatch();
  const appConfig = useAppConfig();
  const refreshAppConfig = useRefreshAppConfig();


  // strings

  const refreshS = "Mettre à jour la configuration";

  // state

  const [loading, setLoading] = useState(false);

  // helpers

  const title = appConfig?.name ?? "-?-";
  const subtitle = appConfig?.version ?? "-?-";

  // handlers

  async function handleRefresh() {
    setLoading(true);
    await refreshAppConfig();
    await dispatch(setToaster({message: "Configuration actualisée"}));
    setLoading(false);
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: 1,
        p: 1,
        bgcolor: "background.default",
      }}
    >
      <Box>
        <Typography>{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      <Tooltip title={refreshS}><IconButton onClick={handleRefresh} loading={loading}>
        <Refresh />
      </IconButton></Tooltip>
      
    </Box>
  );
}
