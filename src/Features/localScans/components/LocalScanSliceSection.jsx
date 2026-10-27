/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import LocalScanSlicePreview from "./LocalScanSlicePreview";
import { getSliceDomain } from "../utils/slicePreviewGeometry";
import getLocalScanSliceFrame from "../utils/getLocalScanSliceFrame";
import createLocalScanSliceOverlay from "../services/createLocalScanSliceOverlay";

export default function LocalScanSliceSection({
  editor,
  view,
  placementKey,
  axesYaw,
  rotation,
  onRotate,
  onResetRotation,
}) {
  // data
  const frame = useMemo(() => {
    view.root.updateMatrixWorld(true);
    return getLocalScanSliceFrame(
      view.data.bounds,
      view.root.matrixWorld.elements,
      axesYaw
    );
    // placementKey represents mutable Three.js matrix values.
  }, [view, placementKey, axesYaw]);
  // Horizontal rotations must preserve the selected Z interval.
  const frameKey = JSON.stringify(
    frame.rows.slice(8).map((value) => Number(value.toFixed(9)))
  );
  const { min: domainMin, max: domainMax } = getSliceDomain(
    frame.min[2],
    frame.max[2]
  );
  const middle = (domainMin + domainMax) / 2;

  // state
  const [selection, setSelection] = useState(null);
  const lower =
    selection?.frameKey === frameKey
      ? selection.values[0]
      : Math.max(domainMin, middle - 0.5);
  const upper =
    selection?.frameKey === frameKey
      ? selection.values[1]
      : Math.min(domainMax, middle + 0.5);
  const [tolerance, setTolerance] = useState(2);
  const [mode, setMode] = useState("density");
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const overlayRef = useRef(null);
  const sequenceRef = useRef(0);

  // helpers
  useEffect(() => {
    let worker;
    try {
      worker = new Worker(
        new URL("../workers/projectLocalScan.worker.js", import.meta.url),
        { type: "module" }
      );
      workerRef.current = worker;
      worker.onmessage = ({ data }) => {
        if (workerRef.current !== worker || data.id !== sequenceRef.current)
          return;
        setPending(false);
        if (data.error) {
          setResult(null);
          setError(data.error);
          return;
        }
        setError(null);
        setResult(data.result);
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        setPending(false);
        setResult(null);
        setError("La projection a échoué. Désactivez puis réactivez la coupe.");
        worker.terminate();
        workerRef.current = null;
      };
      worker.postMessage({
        type: "INIT",
        source: {
          positions: view.data.positions,
          colors: view.data.colors,
        },
      });
    } catch {
      setPending(false);
      setError("Impossible de préparer la projection de ce scan.");
      worker?.terminate();
      workerRef.current = null;
    }
    return () => {
      sequenceRef.current++;
      worker?.terminate();
      workerRef.current = null;
    };
  }, [view]);

  useEffect(() => {
    const overlay = createLocalScanSliceOverlay(editor, view, frame);
    overlayRef.current = overlay;
    return () => {
      overlayRef.current = null;
      overlay.dispose();
    };
  }, [editor, view, frame]);

  useEffect(() => {
    overlayRef.current?.setRange(lower, upper, tolerance / 100);
  }, [frame, lower, upper, tolerance]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const id = ++sequenceRef.current;
    // Cancel immediately; do not allow stale work to accumulate during drags.
    worker.postMessage({ type: "CANCEL", id });
    setPending(true);
    setError(null);
    const timer = setTimeout(() => {
      worker.postMessage({
        type: "PROJECT",
        id,
        query: { frame, lower, upper },
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [frame, lower, upper]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!result) {
      canvas.width = 1;
      canvas.height = 1;
      return;
    }
    canvas.width = result.width;
    canvas.height = result.height;
    canvas
      .getContext("2d")
      .putImageData(
        new ImageData(result[mode], result.width, result.height),
        0,
        0
      );
  }, [result, mode]);

  // handlers
  function changeRange(values) {
    setSelection({ frameKey, values });
  }
  function commitLimit(index, input) {
    const numeric = Number(input.value);
    if (!input.value || !Number.isFinite(numeric)) {
      input.value = String(index === 0 ? lower : upper);
      return;
    }
    const bounded = Math.max(domainMin, Math.min(domainMax, numeric));
    changeRange(
      index === 0
        ? [Math.min(bounded, upper), upper]
        : [lower, Math.max(bounded, lower)]
    );
  }
  function download() {
    if (!result || pending) return;
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `coupe-z-${result.lower.toFixed(2)}-${result.upper.toFixed(2)}-${mode}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  // render
  return (
    <Stack spacing={1} sx={{ borderTop: 1, borderColor: "divider", pt: 1 }}>
      <Typography variant="subtitle2">
        Projection horizontale entre deux Z
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Z en mètres, après placement du scan. Orange : Z inf · Bleu : Z sup.
        Écartez le sol et le plafond pour mieux distinguer les parois. Bornes du
        curseur : Z min et Z max du nuage, avec 5 % de marge de chaque côté.
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "110px minmax(0, 1fr)",
          gap: 2,
        }}
      >
        <Stack spacing={1} alignItems="center">
          <TextField
            key={`upper:${upper}:${frameKey}`}
            label="Z sup (m)"
            type="number"
            size="small"
            defaultValue={Number(upper.toFixed(3))}
            slotProps={{
              htmlInput: { step: 0.01, min: domainMin, max: domainMax },
            }}
            onBlur={(event) => commitLimit(1, event.target)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.target.blur();
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {domainMax.toFixed(2)} m
          </Typography>
          <Box sx={{ height: 220, py: 1 }}>
            <Slider
              orientation="vertical"
              value={[lower, upper]}
              min={domainMin}
              max={domainMax}
              step={0.01}
              disableSwap
              valueLabelDisplay="auto"
              getAriaLabel={(index) => (index === 0 ? "Z inf" : "Z sup")}
              getAriaValueText={(value) => `${value.toFixed(2)} mètres`}
              valueLabelFormat={(value) => `${value.toFixed(2)} m`}
              onChange={(_, values) => changeRange(values)}
              sx={{
                color: "#00a6c7",
                '& .MuiSlider-thumb[data-index="0"]': { color: "#ff610d" },
              }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {domainMin.toFixed(2)} m
          </Typography>
          <TextField
            key={`lower:${lower}:${frameKey}`}
            label="Z inf (m)"
            type="number"
            size="small"
            defaultValue={Number(lower.toFixed(3))}
            slotProps={{
              htmlInput: { step: 0.01, min: domainMin, max: domainMax },
            }}
            onBlur={(event) => commitLimit(0, event.target)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.target.blur();
            }}
          />
        </Stack>
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_, value) => {
              if (value) setMode(value);
            }}
          >
            <ToggleButton value="density">Densité</ToggleButton>
            <ToggleButton value="rgb">Couleurs</ToggleButton>
          </ToggleButtonGroup>
          <Box component="canvas" ref={canvasRef} sx={{ display: "none" }} />
          <LocalScanSlicePreview
            key={frame.rows.join(",")}
            result={result}
            mode={mode}
            pending={pending || Boolean(error)}
            onRotate={onRotate}
          />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption">
              Rotation du scan : {rotation.toFixed(1)}°
            </Typography>
            <Button
              size="small"
              disabled={rotation === 0}
              onClick={onResetRotation}
            >
              Réinitialiser la rotation
            </Button>
          </Stack>
          <Typography variant="caption" aria-live="polite">
            {pending
              ? result
                ? "Actualisation… aperçu précédent."
                : "Calcul de la projection…"
              : result
                ? `${result.pointCount.toLocaleString("fr-FR")} points · ${(result.pixelSize * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} cm/pixel`
                : ""}
            {result &&
              !pending &&
              result.pointCount === 0 &&
              " Aucun point dans cet intervalle."}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            +X vers la droite, +Y vers le haut (repère affiché).
            {mode === "density"
              ? " Densité logarithmique : plus c’est sombre, plus il y a de points. Ce n’est pas une détection automatique de murs."
              : " Moyenne des couleurs de tous les points de l’intervalle."}
          </Typography>
          <Button
            size="small"
            disabled={!result || pending || Boolean(error)}
            onClick={download}
          >
            Télécharger PNG
          </Button>
        </Stack>
      </Box>
      <TextField
        label="Tolérance 3D ± (cm)"
        type="number"
        size="small"
        value={tolerance}
        onChange={(event) =>
          setTolerance(
            Math.max(0.1, Math.min(50, Number(event.target.value) || 0.1))
          )
        }
        sx={{ width: 190 }}
      />
      <Typography variant="caption" color="text.secondary">
        La tolérance sert uniquement au surlignage 3D. L’image utilise
        exactement l’intervalle Z inf–Z sup.
      </Typography>
      {error && <Alert severity="warning">{error}</Alert>}
    </Stack>
  );
}
