import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import DxfPreview from "./DxfPreview";
import useCreateBaseMapFromDxf from "../hooks/useCreateBaseMapFromDxf";

import { getDxfFrame } from "../utils/dxfFrame.js";
import { DXF_UNITS } from "../utils/dxfUnits.js";

export default function DialogCreateBaseMapFromDxf({
  file,
  listing,
  onClose,
  onCreated,
}) {
  // state
  const [drawing, setDrawing] = useState(null);
  const [hiddenLayers, setHiddenLayers] = useState(new Set());
  const [name, setName] = useState(file.name.replace(/\.dxf$/i, ""));
  const [unitCode, setUnitCode] = useState("");
  const [resolution, setResolution] = useState(2400);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const createBaseMap = useCreateBaseMapFromDxf();

  // effects
  useEffect(() => {
    if (file.size > 30 * 1024 * 1024) {
      setError("Ce fichier dépasse 30 Mo. Exportez une sélection plus petite.");
      return;
    }
    const worker = new Worker(
      new URL("../workers/parseDxf.worker.js", import.meta.url),
      { type: "module" }
    );
    let cancelled = false;
    const timer = setTimeout(() => {
      worker.terminate();
      setError(
        "La lecture du DXF a dépassé 30 secondes. Exportez une sélection plus petite."
      );
    }, 30000);
    const stop = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onmessage = ({ data }) => {
      if (cancelled) return;
      stop();
      if (data.error) {
        setError(data.error);
        return;
      }
      setDrawing(data.drawing);
      setHiddenLayers(
        new Set(
          data.drawing.layers
            .filter((layer) => !layer.visible)
            .map((layer) => layer.name)
        )
      );
      setUnitCode(
        DXF_UNITS.some((unit) => unit.code === data.drawing.unitCode)
          ? data.drawing.unitCode
          : ""
      );
    };
    worker.onerror = () => {
      stop();
      setError("Impossible de lire le DXF. Vérifiez le fichier et réessayez.");
    };
    file
      .arrayBuffer()
      .then((buffer) => {
        if (!cancelled) worker.postMessage(buffer, [buffer]);
      })
      .catch(() => {
        if (!cancelled) {
          stop();
          setError("Impossible d’ouvrir le fichier DXF.");
        }
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [file]);

  // data
  const frameResult = useMemo(() => {
    if (!drawing) return {};
    try {
      return { frame: getDxfFrame(drawing.bounds, resolution) };
    } catch (error) {
      return { error: error.message };
    }
  }, [drawing, resolution]);
  const frame = frameResult.frame;
  const unit = DXF_UNITS.find((unit) => unit.code === unitCode);
  const visibleCount =
    drawing?.layers.reduce(
      (sum, layer) => sum + (hiddenLayers.has(layer.name) ? 0 : layer.count),
      0
    ) ?? 0;
  const skipped = Object.entries(drawing?.skipped ?? {});
  const warnings = Object.entries(drawing?.warnings ?? {});

  // handlers
  function toggleLayer(name) {
    setHiddenLayers((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleCreate() {
    if (creatingRef.current || !frame || !unit) return;
    creatingRef.current = true;
    setCreating(true);
    setError("");
    try {
      const baseMap = await createBaseMap({
        file,
        drawing,
        frame,
        hiddenLayers,
        name: name.trim(),
        unit,
        listing,
      });
      onCreated(baseMap);
    } catch (error) {
      setError(error.message || "L’import du DXF a échoué.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  // render
  return (
    <Dialog
      open
      fullWidth
      maxWidth="lg"
      onClose={() => {
        if (!creating) onClose();
      }}
      aria-labelledby="dxf-dialog-title"
    >
      <DialogTitle id="dxf-dialog-title">
        Importer un fond de plan DXF
      </DialogTitle>
      <DialogContent dividers>
        {(error || frameResult.error) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error || frameResult.error}
          </Alert>
        )}
        {!drawing && !error && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 4 }}>
            <CircularProgress size={24} />
            <Typography>Lecture des calques et des géométries…</Typography>
          </Box>
        )}
        {drawing && frame && (
          <>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
              <TextField
                label="Nom du fond de plan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creating}
                size="small"
                sx={{ flex: 1, minWidth: 220 }}
              />
              <TextField
                select
                label="Unité du dessin"
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                disabled={creating}
                size="small"
                sx={{ minWidth: 160 }}
                error={!unit}
                helperText={
                  !unit
                    ? "Unité absente ou inconnue : choisissez-la."
                    : undefined
                }
              >
                <MenuItem value="" disabled>
                  Choisir l’unité
                </MenuItem>
                {DXF_UNITS.map((unit) => (
                  <MenuItem key={unit.code} value={unit.code}>
                    {unit.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Résolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                disabled={creating}
                size="small"
                sx={{ minWidth: 150 }}
              >
                {[1200, 2400, 4800].map((size) => (
                  <MenuItem key={size} value={size}>
                    {size} px
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                gap: 3,
                pointerEvents: creating ? "none" : "auto",
              }}
            >
              <Box sx={{ width: { xs: "100%", md: 290 }, flexShrink: 0 }}>
                <Typography variant="subtitle2">
                  Calques ({drawing.layers.length})
                </Typography>
                <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                  <Button
                    size="small"
                    disabled={creating}
                    onClick={() => setHiddenLayers(new Set())}
                  >
                    Tout afficher
                  </Button>
                  <Button
                    size="small"
                    disabled={creating}
                    onClick={() =>
                      setHiddenLayers(
                        new Set(drawing.layers.map((layer) => layer.name))
                      )
                    }
                  >
                    Tout masquer
                  </Button>
                </Box>
                <Box sx={{ maxHeight: 380, overflowY: "auto" }}>
                  {drawing.layers.map((layer) => (
                    <Box
                      key={layer.name}
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          flexShrink: 0,
                          bgcolor: layer.color,
                          border: 1,
                          borderColor: "divider",
                        }}
                      />
                      <FormControlLabel
                        sx={{ m: 0, minWidth: 0 }}
                        control={
                          <Checkbox
                            size="small"
                            checked={!hiddenLayers.has(layer.name)}
                            disabled={creating}
                            onChange={() => toggleLayer(layer.name)}
                          />
                        }
                        label={
                          <Typography
                            variant="body2"
                            sx={{ overflowWrap: "anywhere" }}
                          >
                            {layer.name} ({layer.count})
                          </Typography>
                        }
                      />
                    </Box>
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Les calques masqués sont conservés et pourront être réaffichés
                  après l’import.
                </Typography>
              </Box>
              <DxfPreview
                drawing={drawing}
                frame={frame}
                hiddenLayers={hiddenLayers}
              />
            </Box>
            <Alert severity="info" sx={{ mt: 2 }}>
              {drawing.objects.length} annotations, dont {visibleCount}{" "}
              visibles. Un listing « DXF — {name.trim()} » sera créé avec une
              version éditable et une image de référence du rendu visible.
            </Alert>
            {(skipped.length > 0 ||
              warnings.length > 0 ||
              drawing.curvedCount > 0) && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {drawing.curvedCount > 0 &&
                  `${drawing.curvedCount} courbes seront approchées par des polylignes. `}
                {skipped.length > 0 &&
                  `Objets non importés : ${skipped.map(([type, count]) => `${type} (${count})`).join(", ")}. `}
                {warnings
                  .map(([message, count]) => `${message} (${count}). `)
                  .join("")}
              </Alert>
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1 }}
            >
              TEXT et MTEXT deviennent des textes éditables, avec une mise en
              forme uniforme. Les cotations sont décomposées en traits, flèches
              et textes ; elles ne se recalculent pas automatiquement. Les HATCH
              deviennent des polygones avec évidements et hachures diagonales,
              ou un remplissage plein pour les aplats.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={creating}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={
            creating ||
            !drawing ||
            !frame ||
            !unit ||
            !name.trim() ||
            !listing?.id
          }
          startIcon={
            creating ? (
              <CircularProgress size={18} color="inherit" />
            ) : undefined
          }
        >
          {creating ? "Création…" : "Créer le fond de plan"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

DialogCreateBaseMapFromDxf.propTypes = {
  file: PropTypes.object.isRequired,
  listing: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
};
