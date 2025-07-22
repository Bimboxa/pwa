import { useNavigate } from "react-router-dom";

import { Box } from "@mui/material";

import { Button, Typography } from "@mui/material";

export default function BlockStartButtons({ isMobile, onShowCreateData }) {
  const navigate = useNavigate();

  // strings

  const startOfflineS = "Démarrer sans compte";
  const startOnlineS = "Se connecter";

  // handlers

  function handleStartOffline() {
    onShowCreateData();
  }

  function handleStartOnline() {
    navigate("/sign-in");
  }

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        width: 1,
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "center" : "flex-start",
      }}
    >
      <Button
        sx={{ width: 240 }}
        variant="outlined"
        onClick={handleStartOffline}
        color="secondary"
      >
        <Typography noWrap>{startOfflineS}</Typography>
      </Button>

      <Button
        sx={{ width: 240, ...(isMobile && { mt: 2 }) }}
        variant="contained"
        onClick={handleStartOnline}
        color="secondary"
      >
        <Typography>{startOnlineS}</Typography>
      </Button>
    </Box>
  );
}
