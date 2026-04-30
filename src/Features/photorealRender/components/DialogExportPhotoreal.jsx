import { useEffect, useMemo, useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import Close from "@mui/icons-material/Close";
import ContentCopy from "@mui/icons-material/ContentCopy";
import Download from "@mui/icons-material/Download";
import Map from "@mui/icons-material/Map";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import useCreateBaseMaps from "Features/baseMapCreator/hooks/useCreateBaseMaps";
import renderPhotorealAsync from "../services/renderPhotorealAsync";

const PRESETS = {
  QUICK: { label: "Rapide", samples: 256, bounces: 2 },
  HIGH: { label: "Haute qualité", samples: 1024, bounces: 2 },
};

// Approximate size of a base64 dataURL payload, in bytes.
function dataUrlByteSize(dataUrl) {
  if (!dataUrl) return 0;
  const idx = dataUrl.indexOf(",");
  const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  // base64 inflates by 4/3 — strip up to 2 padding "=" before measuring.
  const padding = (base64.match(/=+$/) || [""])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

export default function DialogExportPhotoreal({ presetKey, onClose }) {
  const createBaseMaps = useCreateBaseMaps();

  const [status, setStatus] = useState("idle"); // "idle" | "rendering" | "done" | "error"
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [imageUrl, setImageUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [creatingBasemap, setCreatingBasemap] = useState(false);

  const open = presetKey !== null && presetKey !== undefined;

  const sizeLabel = useMemo(
    () => (imageUrl ? stringifyFileSize(dataUrlByteSize(imageUrl)) : ""),
    [imageUrl]
  );

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setProgress({ current: 0, total: 0 });
      setImageUrl(null);
      setErrorMessage(null);
      setCopied(false);
      setCreatingBasemap(false);
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
    // Cap render dimensions: the path-tracer allocates several float textures
    // (accumulation, BVH, materials) at this size — exceeding the GPU's
    // MAX_TEXTURE_SIZE causes the render to fail silently and only the
    // basemap raster layer survives. 4096 leaves headroom on most GPUs.
    const MAX_RENDER_DIM = 4096;
    const targetW = liveCanvas.clientWidth * 2;
    const targetH = liveCanvas.clientHeight * 2;
    const fit = Math.min(1, MAX_RENDER_DIM / Math.max(targetW, targetH));
    const width = Math.floor(targetW * fit);
    const height = Math.floor(targetH * fit);

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
    a.download = `render-3d-${timestamp()}.png`;
    a.click();
  }

  async function handleCopy() {
    if (!imageUrl) return;
    try {
      const blob = await dataUrlToBlob(imageUrl);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("[copy to clipboard]", e);
    }
  }

  async function handleCreateBasemap() {
    if (!imageUrl) return;
    setCreatingBasemap(true);
    try {
      const blob = await dataUrlToBlob(imageUrl);
      const name = `Rendu 3D ${timestamp()}`;
      const file = new File([blob], `${name}.png`, { type: "image/png" });
      // meterByPx left null — a perspective render has no meaningful scale,
      // user calibrates the basemap manually after creation if needed.
      await createBaseMaps([{ name, imageFile: file, meterByPx: null }]);
      onClose?.();
    } catch (e) {
      console.error("[createBaseMap from render]", e);
      setErrorMessage(e?.message || String(e));
      setStatus("error");
    } finally {
      setCreatingBasemap(false);
    }
  }

  const isRendering = status === "rendering";
  const progressPct = progress.total
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
        <Box sx={{ flex: 1 }}>Export photoréaliste</Box>
        <IconButton
          size="small"
          onClick={handleClose}
          disabled={isRendering}
          aria-label="Fermer"
        >
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

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
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box
              sx={{
                position: "relative",
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
              <Tooltip title={copied ? "Copié" : "Copier dans le presse-papier"}>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{
                    position: "absolute",
                    bottom: 12,
                    right: 12,
                    bgcolor: "background.paper",
                    boxShadow: 1,
                    "&:hover": { bgcolor: "background.paper" },
                  }}
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Taille : {sizeLabel}
            </Typography>
          </Box>
        )}

        {status === "error" && (
          <Typography color="error" variant="body2">
            {errorMessage}
          </Typography>
        )}
      </DialogContent>

      {status === "done" && (
        <DialogActions>
          <Button
            variant="outlined"
            startIcon={<Map />}
            onClick={handleCreateBasemap}
            disabled={creatingBasemap}
          >
            {creatingBasemap ? "Création…" : "Créer un fond de plan"}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Download />}
            onClick={handleDownload}
          >
            Télécharger
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
