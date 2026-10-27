/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControlLabel,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import Scene3dZoneEditor from "Features/scene3d/components/Scene3dZoneEditor";
import { getScene3dBboxPolygon } from "Features/scene3d/utils/getScene3dBaseMapDescriptor";
import { getZoneFromPolygon } from "Features/scene3d/utils/scene3dZoneTransform";
import {
  buildLocalScanZonePreview,
  readLocalScanSample,
} from "../services/createLocalScanZonePreview";

const EMPTY_VALUE = { rotationDeg: 0, polygonScan: null };

// Zone of a point cloud chosen before it is decoded: a top-down density map
// of a regular sample, the Scene3dZoneEditor of the « Scène 3D » import and
// a height range. → onConfirm({zone, wholePolygon}) — see localScanZone.js.
export default function DialogLocalScanZone({
  file,
  initialZone,
  onCancel,
  onConfirm,
}) {
  // strings

  const titleS = "Zone à charger";
  const readingS = "Lecture d’un échantillon du nuage…";
  const upS = "Axe vertical";
  const heightS = "Hauteur";
  const recenterS = "Centrer sur la zone";
  const loadS = "Charger";
  const splatS =
    "Mode Réaliste : la zone limite les points, les gaussiennes restent entières.";
  const sizeS = (zone) =>
    `Zone : ${zone.width.toFixed(1)} × ${zone.height.toFixed(1)} m`;
  const heightLabelS = ([min, max]) =>
    `${min.toFixed(2)} à ${max.toFixed(2)} m`;

  // state

  const [sample, setSample] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [up, setUp] = useState(initialZone?.up ?? "Z");
  const [preview, setPreview] = useState(null);
  const [value, setValue] = useState(() =>
    initialZone
      ? {
          rotationDeg: initialZone.rotationDeg ?? 0,
          polygonScan: initialZone.polygon ?? null,
        }
      : EMPTY_VALUE
  );
  const [range, setRange] = useState(null);
  const [recenter, setRecenter] = useState(initialZone?.recenter ?? true);

  // helpers

  useEffect(() => {
    const controller = new AbortController();
    readLocalScanSample(file, {
      signal: controller.signal,
      onProgress: setProgress,
    }).then(setSample, (failure) => {
      if (failure.name !== "AbortError") setError(failure.message);
    });
    return () => controller.abort();
  }, [file]);

  useEffect(() => {
    if (!sample) return;
    let alive = true,
      url = null;
    buildLocalScanZonePreview(sample, up).then(
      (next) => {
        url = next.url;
        if (!alive) return URL.revokeObjectURL(url);
        setPreview(next);
        setRange((previous) => {
          if (previous) return [next.useful.min, next.useful.max];
          const saved = initialZone?.up === up ? initialZone : null;
          return Number.isFinite(saved?.zMin) && Number.isFinite(saved?.zMax)
            ? [saved.zMin, saved.zMax]
            : [next.useful.min, next.useful.max];
        });
      },
      (failure) => {
        if (alive) setError(failure.message);
      }
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // initialZone only seeds the first preview.
  }, [sample, up]);

  const wholePolygon = preview ? getScene3dBboxPolygon(preview.bbox) : null;
  const zoneSize = wholePolygon
    ? getZoneFromPolygon(value.polygonScan ?? wholePolygon, value.rotationDeg)
    : null;

  // handlers

  function handleUpChange(_, next) {
    if (!next || next === up) return;
    // The drawn polygon belongs to the previous horizontal frame.
    setValue(EMPTY_VALUE);
    setPreview(null);
    setUp(next);
  }

  function handleConfirm() {
    if (!preview || !range) return;
    onConfirm({
      zone: {
        up,
        polygon: value.polygonScan,
        rotationDeg: value.rotationDeg ?? 0,
        zMin: range[0],
        zMax: range[1],
        recenter,
      },
      wholePolygon,
    });
  }

  // render

  return (
    <Dialog open onClose={onCancel} fullScreen>
      <Box
        sx={{
          position: "relative",
          width: 1,
          flexGrow: 1,
          minHeight: 0,
          bgcolor: "grey.200",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {preview ? (
          <Box sx={{ position: "absolute", inset: 0 }}>
            <Scene3dZoneEditor
              key={up}
              previewUrl={preview.url}
              previewSize={preview.size}
              bbox={preview.bbox}
              pxPerMeter={preview.pxPerMeter}
              value={value}
              onChange={setValue}
            />
          </Box>
        ) : (
          <Paper sx={{ p: 2, width: 360 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {error ?? readingS}
            </Typography>
            {!error && (
              <LinearProgress
                variant={progress > 0 ? "determinate" : "indeterminate"}
                value={Math.round(progress * 100)}
              />
            )}
          </Paper>
        )}

        <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 2 }}>
          <Paper sx={{ px: 2, py: 1, maxWidth: 360 }}>
            <Typography variant="subtitle2">{titleS}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {file.name ?? ""}
              {sample &&
                ` · aperçu ${sample.count.toLocaleString("fr-FR")} / ${sample.sourceCount.toLocaleString("fr-FR")} points`}
            </Typography>
            {sample?.kind === "SPLAT" && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block" }}
              >
                {splatS}
              </Typography>
            )}
          </Paper>
        </Box>

        <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}>
          <Paper>
            <IconButtonClose onClose={onCancel} />
          </Paper>
        </Box>

        {preview && range && (
          <Box
            sx={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
            }}
          >
            <Paper
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                px: 2,
                py: 1,
              }}
            >
              {zoneSize && (
                <Typography variant="body2" color="text.secondary" noWrap>
                  {sizeS(zoneSize)}
                </Typography>
              )}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" noWrap>
                  {upS}
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={up}
                  onChange={handleUpChange}
                >
                  <ToggleButton value="Z">Z</ToggleButton>
                  <ToggleButton value="Y">Y</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Stack sx={{ width: 220 }}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {heightS} : {heightLabelS(range)}
                </Typography>
                <Slider
                  size="small"
                  value={range}
                  min={preview.extent.min}
                  max={preview.extent.max}
                  step={(preview.extent.max - preview.extent.min) / 500 || 0.01}
                  disableSwap
                  onChange={(_, next) => setRange(next)}
                />
              </Stack>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={recenter}
                    onChange={(_, checked) => setRecenter(checked)}
                  />
                }
                label={recenterS}
                sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: 14 } }}
              />
              <Button variant="contained" onClick={handleConfirm}>
                {loadS}
              </Button>
            </Paper>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
