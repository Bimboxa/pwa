import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import { Box, Paper, IconButton, Tooltip } from "@mui/material";
import { Settings } from "@mui/icons-material";

import ContainerScope from "Features/scopes/components/ContainerScope";

export default function BlockSelectedScope() {
  // strings

  const settingsS = "Paramétrage";

  // data

  const { value: scope } = useSelectedScope();

  // handlers

  function handleSettingsClick() {
    console.log("settings");
  }

  return (
    <Box sx={{ p: 1 }}>
      <Box
        sx={{
          p: 0.5,
          width: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: "8px",
          border: (theme) => `1px solid ${theme.palette.secondary.main}`,
        }}
      >
        <ContainerScope scope={scope} />
        <Tooltip title={settingsS}>
          <IconButton onClick={handleSettingsClick}>
            <Settings />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
