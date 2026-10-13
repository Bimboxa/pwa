import { useDispatch, useSelector } from "react-redux";

import { requestWallVectorization } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from "@mui/material";

import ShortcutBadge from "./ShortcutBadge";
import BadgeSpaceCommit from "./BadgeSpaceCommit";

// « Détection auto » card of the clic-clic polyline helper: vectorizes the
// black wall bands of the baseMap whose thickness matches the drawn stroke
// width (toolbar / template) into 2-point segments.
//
// The button bumps `wallVectorizationRequestId`; InteractionLayer owns the
// run (it needs the baseMap / scale / annotations refs) and launches it on
// change — same path as the V key. Space commits the candidates, Escape
// drops them.
export default function CardWallVectorization() {
  // strings

  const titleS = "Détection auto";
  const launchS = "Lancer la détection";
  const runningS = "Détection en cours…";
  const validateS = "Valider la sélection";

  // data

  const dispatch = useDispatch();
  const running = useSelector((s) => s.mapEditor.globalDetectionRunning);
  const smartDetectionPresent = useSelector(
    (s) => s.mapEditor.smartDetectionPresent
  );

  // handlers

  const handleLaunch = () => {
    if (running) return;
    dispatch(requestWallVectorization());
  };

  // render

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 1,
        bgcolor: "background.paper",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 700,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          color: "text.secondary",
          letterSpacing: 0.5,
          mb: 0.5,
        }}
      >
        {titleS}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={handleLaunch}
          disabled={running}
          startIcon={
            running ? <CircularProgress size={14} color="inherit" /> : null
          }
          sx={{ flex: 1, textTransform: "none", justifyContent: "flex-start" }}
        >
          {running ? runningS : launchS}
        </Button>
        <ShortcutBadge>V</ShortcutBadge>
      </Box>

      {smartDetectionPresent && (
        <Box
          sx={{
            mt: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 0.5,
          }}
        >
          <Typography variant="body2" sx={{ flex: 1 }}>
            {validateS}
          </Typography>
          <BadgeSpaceCommit active />
        </Box>
      )}
    </Paper>
  );
}
