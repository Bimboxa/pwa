import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setConfigCode } from "../appConfigSlice";
import { setToaster } from "Features/layout/layoutSlice";

import useAppConfig from "../hooks/useAppConfig";
import useRefreshAppConfig from "../hooks/useRefreshAppConfig";

import { Box, Button, Typography, Tooltip, TextField } from "@mui/material";
import { Refresh } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function SectionAppConfigTitle() {
  const dispatch = useDispatch();
  const appConfig = useAppConfig();
  const refreshAppConfig = useRefreshAppConfig();

  // strings

  const refreshS = "Mettre à jour";

  // data

  const configCode = useSelector((s) => s.appConfig.configCode);

  // state

  const [loading, setLoading] = useState(false);

  // helpers

  const title = appConfig?.name ?? "-?-";
  const subtitle = appConfig?.version ?? "-?-";

  // handlers

  async function handleRefresh() {
    setLoading(true);
    await refreshAppConfig({ configCode });
    await dispatch(setToaster({ message: "Configuration actualisée" }));
    setLoading(false);
  }

  return (
    <Box sx={{ width: 1, p: 1, display: "flex", flexDirection: "column" }}>
      <Box>
        <TextField
          size="small"
          label="Code"
          value={configCode}
          onChange={(e) => dispatch(setConfigCode(e.target.value))}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: 1,
          p: 1,
        }}
      >
        <Box>
          <Typography>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <Tooltip title={refreshS}>
          <ButtonGeneric
            onClick={handleRefresh}
            label={refreshS}
            variant="contained"
          />
        </Tooltip>
      </Box>
    </Box>
  );
}
