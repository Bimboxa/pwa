import { useEffect, useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from "@mui/material";
import Download from "@mui/icons-material/Download";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import renderPhotorealAsync from "../services/renderPhotorealAsync";

const PRESETS = {
  QUICK: { label: "Rapide", samples: 256, bounces: 2 },
  HIGH: { label: "Haute qualité", samples: 1024, bounces: 2 },
};

// Triggered by the Properties popover passing in `presetKey`. When the prop
// becomes non-null we kick off the render automatically; closing resets it.
export default function DialogExportPhotoreal({ presetKey, onClose }) {
  const [status, setStatus] = useState("idle"); // "idle" | "rendering" | "done" | "error"
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [imageUrl, setImageUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const open = presetKey !== null && presetKey !== undefined;

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setProgress({ current: 0, total: 0 });
      setImageUrl(null);
      setErrorMessage(null);
      return;
    }
    const preset = PRESETS[presetKey];
    if (!preset) return;

    const editor = getActiveThreedEditor();
    if (!editor?.sceneManager) {
      setStatus("error");
      setErrorMessage("Viewer 3D non actif.");
      return;
    }

    const { scene, camera, renderer } = editor.sceneManager;
    const liveCanvas = renderer.domElement;
    const width = liveCanvas.clientWidth * 2;
    const height = liveCanvas.clientHeight * 2;

    let cancelled = false;

    setStatus("rendering");
    setProgress({ current: 0, total: preset.samples });
    setImageUrl(null);
    setErrorMessage(null);

    (async () => {
      try {
        const dataUrl = await renderPhotorealAsync({
          scene,
          camera,
          width,
          height,
          samples: preset.samples,
          bounces: preset.bounces,
          onProgress: (current, total) => {
            if (cancelled) return;
            setProgress({ current, total });
          },
        });
        if (cancelled) return;
        setImageUrl(dataUrl);
        setStatus("done");
      } catch (e) {
        if (cancelled) return;
        console.error("[renderPhotorealAsync]", e);
        setErrorMessage(e?.message || String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, presetKey]);

  function handleClose() {
    if (status === "rendering") return;
    onClose?.();
  }

  function handleDownload() {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `render-3d-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.png`;
    a.click();
  }

  const isRendering = status === "rendering";
  const progressPct = progress.total
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Export photoréaliste</DialogTitle>
      <DialogContent dividers>
        {status === "rendering" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="body2">
              Calcul en cours… {progress.current} / {progress.total} samples
            </Typography>
            <LinearProgress variant="determinate" value={progressPct} />
          </Box>
        )}

        {status === "done" && imageUrl && (
          <Box
            sx={{
              bgcolor: "grey.200",
              borderRadius: 1,
              p: 1,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Box
              component="img"
              src={imageUrl}
              alt="Rendu 3D"
              sx={{ maxWidth: "100%", maxHeight: 480, borderRadius: 0.5 }}
            />
          </Box>
        )}

        {status === "error" && (
          <Typography color="error" variant="body2">
            {errorMessage}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isRendering}>
          Fermer
        </Button>
        {status === "done" && (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Download />}
            onClick={handleDownload}
          >
            Télécharger
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
