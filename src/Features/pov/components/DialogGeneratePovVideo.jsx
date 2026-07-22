import { useRef, useState } from "react";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import generatePovVideoService, {
  PovVideoCancelled,
} from "../services/generatePovVideoService";
import { isMp4EncodingSupported } from "../utils/encodeFramesToMp4";

const FPS_OPTIONS = [24, 30, 60];
const QUALITY_OPTIONS = [
  { longSide: 1280, label: "HD (1280 px)" },
  { longSide: 1920, label: "Full HD (1920 px)" },
  { longSide: 2560, label: "2K (2560 px)" },
];

// Settings + progress of the POV fly-through export. The generation runs
// while the dialog is open (disableScrollLock: a scrollbar-gutter shift would
// move the capture frame mid-render).
export default function DialogGeneratePovVideo({
  open,
  onClose,
  povs,
  excluded2dCount,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Générer une vidéo";
  const descriptionS = `${povs.length} vues 3D seront enchaînées, dans l'ordre de la liste.`;
  const excludedS = `${excluded2dCount} vue(s) 2D ignorée(s) : seules les vues 3D peuvent être animées.`;
  const holdLabelS = "Durée par vue (s)";
  const flightLabelS = "Durée de transition (s)";
  const fpsS = "Images / s";
  const qualityS = "Qualité";
  const cancelS = "Annuler";
  const generateS = "Générer";
  const unsupportedS =
    "Votre navigateur ne supporte pas l'encodage vidéo (WebCodecs).";
  const runningS = "Génération en cours — laissez cet onglet au premier plan.";
  const errorS = "Échec de la génération de la vidéo";
  const doneS = "Vidéo générée";

  // state

  const [holdSec, setHold] = useState(2);
  const [flightSec, setFlightSec] = useState(2.5);
  const [fps, setFps] = useState(30);
  const [longSide, setLongSide] = useState(1920);
  const [progress, setProgress] = useState(null); // {done, total} | null

  const cancelledRef = useRef(false);

  // helpers

  const supported = isMp4EncodingSupported();
  const running = progress !== null;
  const estimatedS = `Durée estimée : ${Math.round(
    povs.length * holdSec + Math.max(0, povs.length - 1) * flightSec
  )} s`;
  const percent =
    progress?.total > 0 ? (100 * progress.done) / progress.total : 0;

  // handlers

  function handleClose() {
    if (running) return;
    onClose();
  }

  function handleCancel() {
    if (running) {
      cancelledRef.current = true;
      return;
    }
    onClose();
  }

  async function handleGenerate() {
    if (running) return;
    cancelledRef.current = false;
    setProgress({ done: 0, total: 1 });
    try {
      await generatePovVideoService({
        povs,
        dispatch,
        settings: {
          holdMs: Math.max(200, holdSec * 1000),
          flightMs: Math.max(200, flightSec * 1000),
          fps,
          longSide,
        },
        onProgress: setProgress,
        shouldCancel: () => cancelledRef.current,
      });
      dispatch(setToaster({ message: doneS }));
      onClose();
    } catch (error) {
      if (!(error instanceof PovVideoCancelled)) {
        console.error("[DialogGeneratePovVideo]", error);
        dispatch(setToaster({ message: errorS, isError: true }));
      }
    } finally {
      setProgress(null);
    }
  }

  // render

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      disableScrollLock
    >
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {!supported && <Alert severity="error">{unsupportedS}</Alert>}

          <Typography variant="body2" color="text.secondary">
            {descriptionS}
          </Typography>
          {excluded2dCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              {excludedS}
            </Typography>
          )}

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              size="small"
              type="number"
              label={holdLabelS}
              value={holdSec}
              disabled={running}
              onChange={(e) => setHold(Number(e.target.value))}
              inputProps={{ min: 0.5, max: 20, step: 0.5 }}
            />
            <TextField
              size="small"
              type="number"
              label={flightLabelS}
              value={flightSec}
              disabled={running}
              onChange={(e) => setFlightSec(Number(e.target.value))}
              inputProps={{ min: 0.5, max: 20, step: 0.5 }}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              select
              size="small"
              label={fpsS}
              value={fps}
              disabled={running}
              onChange={(e) => setFps(Number(e.target.value))}
              sx={{ width: 120 }}
            >
              {FPS_OPTIONS.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={qualityS}
              value={longSide}
              disabled={running}
              onChange={(e) => setLongSide(Number(e.target.value))}
              sx={{ flex: 1 }}
            >
              {QUALITY_OPTIONS.map((option) => (
                <MenuItem key={option.longSide} value={option.longSide}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Typography variant="caption" color="text.secondary">
            {estimatedS}
          </Typography>

          {running && (
            <Box>
              <LinearProgress variant="determinate" value={percent} />
              <Typography variant="caption" color="text.secondary">
                {`${Math.round(percent)} % — ${runningS}`}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} sx={{ textTransform: "none" }}>
          {cancelS}
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={running || !supported}
          sx={{ textTransform: "none" }}
        >
          {generateS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
